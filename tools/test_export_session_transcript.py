import json
from pathlib import Path
import tempfile
import unittest
from export_session_transcript import CUTOFF_REQUEST, visible_messages


class TranscriptVisibilityTests(unittest.TestCase):
    def read(self, events):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'session.jsonl'
            path.write_text('\n'.join(json.dumps(event) for event in events))
            return list(visible_messages(path))

    def item(self, kind, identifier, text, phase=None):
        return {'type': 'event_msg', 'timestamp': '2026-09-05T00:00:00Z', 'payload': {
            'type': 'item_completed', 'item': {'type': kind, 'id': identifier,
                'phase': phase, 'content': [{'type': 'Text', 'text': text}]}}}

    def test_only_user_visible_completed_messages_are_exported(self):
        events = [
            {'type': 'response_item', 'payload': {'role': 'system', 'type': 'message', 'content': 'PRIVATE'}},
            self.item('Reasoning', 'reasoning', 'PRIVATE'),
            self.item('CommandExecution', 'command', 'PRIVATE'),
            self.item('McpToolCall', 'tool', 'PRIVATE'),
            self.item('AgentMessage', 'unknown', 'PRIVATE', 'analysis'),
            self.item('UserMessage', 'user', 'hello'),
            self.item('AgentMessage', 'progress', 'working', 'commentary'),
            self.item('AgentMessage', 'reply', 'done', 'final_answer'),
            self.item('AgentMessage', 'reply', 'done', 'final_answer'),
            self.item('UserMessage', 'cutoff', CUTOFF_REQUEST),
            self.item('AgentMessage', 'after', 'not in snapshot', 'commentary'),
        ]
        result = self.read(events)
        self.assertEqual([m['text'] for m in result], ['hello', 'working', 'done', CUTOFF_REQUEST])
        self.assertEqual([m['phase'] for m in result], ['request', 'commentary', 'final', 'request'])
        self.assertNotIn('PRIVATE', json.dumps(result))

    def test_missing_publication_boundary_fails_instead_of_exporting_future_turns(self):
        with self.assertRaisesRegex(ValueError, 'publication request was not found'):
            self.read([self.item('UserMessage', 'user', 'hello')])


if __name__ == '__main__':
    unittest.main()
