"""Export only completed user-visible messages from a Codex rollout.

Usage: python export_session_transcript.py ROLLOUT OUTPUT_DIRECTORY
Requires markdown-it-py. Tool calls/results, reasoning, developer/system input,
runtime metadata, and events after the publication request are not exported.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit, unquote
from markdown_it import MarkdownIt

PUBLIC_ROOT = 'https://yaroslavvb.github.io/animated-groups-fable/'
CUTOFF_REQUEST = 'Publish this session transcript on GitHub pages  and give me link'
ROLE_TYPES = {'UserMessage': 'user', 'AgentMessage': 'assistant'}
PHASES = {'commentary': 'commentary', 'final_answer': 'final', 'final': 'final'}


def visible_messages(path):
    seen = set()
    with path.open() as stream:
        for line in stream:
            event = json.loads(line)
            payload = event.get('payload', {})
            item = payload.get('item', {})
            if event.get('type') != 'event_msg' or payload.get('type') != 'item_completed':
                continue
            if item.get('type') not in ROLE_TYPES or item.get('id') in seen:
                continue
            role = ROLE_TYPES[item['type']]
            if role == 'assistant' and item.get('phase') not in PHASES:
                continue
            seen.add(item['id'])
            text = '\n'.join(part.get('text', '') for part in item.get('content', [])
                             if part.get('type') in ('text', 'Text')).strip()
            yield {'role': role, 'phase': 'request' if role == 'user' else PHASES[item['phase']],
                   'timestamp': event['timestamp'], 'text': text, 'content': item.get('content', [])}
            if role == 'user' and text == CUTOFF_REQUEST:
                return
    raise ValueError('The publication request was not found; refusing an unbounded export.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rollout', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    assets = args.output / 'assets'
    assets.mkdir(exist_ok=True)
    markdown = MarkdownIt('commonmark', {'html': False, 'breaks': True}).enable('table')
    messages = []
    copied = {}

    def copy_asset(path, name=None):
        path = path.resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        name = name or path.name
        destination = assets / name
        if destination.exists() and destination.read_bytes() != path.read_bytes():
            raise ValueError('Conflicting asset name: ' + name)
        shutil.copy2(path, destination)
        copied[str(path)] = 'assets/' + name
        return copied[str(path)]

    def public_path(value):
        """Map referenced local downloads/docs to working public destinations."""
        if value.startswith('/Users/'):
            path = Path(unquote(value))
            if path.name.startswith('scott-gray-g96-') and path.suffix in ('.gif', '.mp4'):
                return copy_asset(path)
            if '/docs/' in value:
                return PUBLIC_ROOT + value.split('/docs/', 1)[1]
            return value
        parsed = urlsplit(value)
        if parsed.hostname in ('localhost', '127.0.0.1') or (parsed.hostname or '').endswith('.ts.net'):
            if parsed.port == 8934:
                return PUBLIC_ROOT + parsed.path.lstrip('/') + ('?' + parsed.query if parsed.query else '') + ('#' + parsed.fragment if parsed.fragment else '')
            if parsed.port == 8935:
                return 'assets/' + (parsed.path.lstrip('/') or 'index.html') + ('#' + parsed.fragment if parsed.fragment else '')
        return value

    def publish_links(text):
        # Local Markdown destinations contain no parentheses in this session.
        text = re.sub(r'\]\((/Users/[^)]+)\)', lambda m: '](' + public_path(m[1]) + ')', text)
        # Only URL strings are rewritten; the rest of the messages stay verbatim.
        return re.sub(r'https?://(?:localhost|127\.0\.0\.1|[\w.-]+\.ts\.net):\d+[^\s<>)]*',
                      lambda m: public_path(m[0]), text)

    for raw in visible_messages(args.rollout):
        text = raw['text']
        attachments = []
        if raw['role'] == 'user':
            text = re.sub(r'<in-app-browser-context\b[^>]*>.*?</in-app-browser-context>', '', text, flags=re.S)
            text = re.sub(r'<environment_context\b[^>]*>.*?</environment_context>', '', text, flags=re.S)
            # UI-generated attachment headings precede the user's actual message.
            if '## My request:' in text:
                text = text.split('## My request:', 1)[1].strip()
            reply = re.fullmatch(r'<send_user_message_question_reply>\s*(.*?)\s*</send_user_message_question_reply>', text.strip(), re.S)
            if reply:
                entries = json.loads(reply[1])
                text = '\n\n'.join('**Question shown:** ' + entry['question'] + '\n\n**Answer:** ' + entry['answer'] for entry in entries)
            if '# Files pasted by the user:' in raw['text']:
                match = re.search(r'(/Users/[^\n]+/pasted-text\.txt)', raw['text'])
                if match:
                    source = Path(match[1])
                    name = 'recovered-session-history.txt'
                    (assets / name).write_text(publish_links(source.read_text()))
                    attachments.append({'url': 'assets/' + name, 'name': 'Recovered session history (attached text)', 'mimeType': 'text/plain'})
        for part in raw['content']:
            if part.get('type') != 'image':
                continue
            image_url = part.get('image_url', '')
            match = re.fullmatch(r'data:(image/(?:png|jpeg));base64,(.+)', image_url, re.S)
            if not match:
                raise ValueError('Unsupported user-image encoding.')
            data = base64.b64decode(match[2], validate=True)
            digest = hashlib.sha256(data).hexdigest()[:12]
            name = 'glider-reference-' + digest + ('.png' if match[1] == 'image/png' else '.jpg')
            (assets / name).write_bytes(data)
            attachments.append({'url': 'assets/' + name, 'name': 'Attached glider reference', 'mimeType': match[1]})
        text = publish_links(text.strip())
        if not text and not attachments:
            continue
        # Fail rather than accidentally publish runtime envelopes or credential material.
        if re.search(r'<(?:environment_context|recommended_plugins|system|developer|in-app-browser-context)\b', text):
            raise ValueError('Runtime envelope in visible message.')
        if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|gho_|sk-proj-)[A-Za-z0-9_-]{20,}', text):
            raise ValueError('Possible credential in visible message; manual review required.')
        messages.append({'id': 'message-%03d' % (len(messages) + 1), 'role': raw['role'],
                         'phase': raw['phase'], 'timestamp': raw['timestamp'], 'text': text,
                         'html': markdown.render(text), 'attachments': attachments})

    # The conversation linked these video preview pages as well as individual media.
    video_root = Path('/Users/yaroslavvb/Downloads/scott-gray-g96-video')
    for name in ('index.html', 'signal.html', 'poster.png'):
        copy_asset(video_root / name)
    # These two are referenced by the latest preview even though the snapshot's
    # original 16-second video link remains available as well.
    for name in ('scott-gray-g96-loop.mp4', 'scott-gray-g96-loop.gif', 'scott-gray-g96-signal.mp4', 'scott-gray-g96-signal.gif'):
        copy_asset(video_root / name)

    scope = ('User messages, assistant replies, and progress updates from September 4–5, 2026, '
             'through the request to publish this transcript. Tool logs and private runtime instructions '
             'are omitted. Automatic browser context and attachment wrappers are removed; structured '
             'question replies are formatted for reading. Local links are rewritten to public copies '
             'or the corresponding live pages. Earlier reports are preserved as written, including '
             'findings that were superseded later in the conversation.')
    document = {'title': 'Gray–Scott: from time symmetry to looping patterns',
                'threadId': '01a06e33-4f8f-7611-a5cf-cbd77b7f2182',
                'exportedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'startedAt': messages[0]['timestamp'],
                'endedAt': messages[-1]['timestamp'], 'messageCount': len(messages),
                'scopeNote': scope, 'messages': messages}
    (args.output / 'transcript.json').write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    lines = ['# ' + document['title'], '', scope, '']
    for message in messages:
        label = 'User' if message['role'] == 'user' else 'Assistant'
        if message['phase'] == 'commentary':
            label += ' · progress update'
        lines.extend(['## ' + label + ' · ' + message['timestamp'], '', message['text'], ''])
        for attachment in message['attachments']:
            prefix = '!' if attachment['mimeType'].startswith('image/') else ''
            lines.extend([prefix + '[' + attachment['name'] + '](' + attachment['url'] + ')', ''])
    (args.output / 'transcript.md').write_text('\n'.join(lines))
    print(json.dumps({'messages': len(messages), 'users': sum(m['role'] == 'user' for m in messages),
                      'assistant': sum(m['role'] == 'assistant' for m in messages),
                      'first': messages[0]['timestamp'], 'last': messages[-1]['timestamp'],
                      'assetBytes': sum(p.stat().st_size for p in assets.iterdir() if p.is_file())}))


if __name__ == '__main__':
    main()
