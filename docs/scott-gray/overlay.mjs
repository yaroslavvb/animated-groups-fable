/**
 * The three named 442 generators from correspondence-p4.html. The path data and
 * Chaim short forms are copied verbatim from that page; exact affine operations
 * and rotation centres come from clockwork-coloring-correspondence.json.
 *
 * Canvas convention: q[y*N+x] is displayed with y downward. Thus R270 is a
 * counterclockwise screen turn and R90 a clockwise screen turn. Do not flip
 * the stored centre.y: the overlay must use the same coordinates as the field.
 */
export const GROUP_DISPLAY = {
  "g94": {
    "id": "g94",
    "shortText": "442",
    "shortHTML": "442",
    "clockOrder": 1,
    "signatureStatus": "onefold",
    "signatureEvidence": "No nontrivial short colour signature is needed.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g94",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.0
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          0.0
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 4,
        "symbol": "rotation-4-0",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z",
        "sourcePlatePosition": [
          360.0,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          -0.5,
          -0.5
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 4,
        "symbol": "rotation-4-0",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z",
        "sourcePlatePosition": [
          286.4,
          283.6
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          0.0,
          -0.5
        ],
        "angleDegrees": 180,
        "operationIndex": 0,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 2,
        "symbol": "rotation-2-0",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z",
        "sourcePlatePosition": [
          360.0,
          283.6
        ]
      }
    ]
  },
  "g95": {
    "id": "g95",
    "shortText": "²4²4¹2",
    "shortHTML": "<sup>2</sup>4<sup>2</sup>4<sup>1</sup>2",
    "clockOrder": 2,
    "signatureStatus": "exact-printed",
    "signatureEvidence": "Table 11.1 prints one short generator signature for this colour type, and the page reproduces it.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g95",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.0
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          0.0
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 4,
        "symbol": "rotation-4-2",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z",
        "sourcePlatePosition": [
          360.0,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          -0.5,
          -0.5
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 4,
        "symbol": "rotation-4-2",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z",
        "sourcePlatePosition": [
          286.4,
          283.6
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          0.0,
          -0.5
        ],
        "angleDegrees": 180,
        "operationIndex": 0,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 2,
        "symbol": "rotation-2-0",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z",
        "sourcePlatePosition": [
          360.0,
          283.6
        ]
      }
    ]
  },
  "g96": {
    "id": "g96",
    "shortText": "⁴4⁴4²2",
    "shortHTML": "<sup>4</sup>4<sup>4</sup>4<sup>2</sup>2",
    "clockOrder": 4,
    "signatureStatus": "rule-extension",
    "signatureEvidence": "The book does not enumerate composite C4 colourings. This short signature is derived from its rule: replace each generator permutation by its order.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g96",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.0
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          0.0
        ],
        "timeShift": "3/4",
        "timeShiftLabel": "+3/4 period",
        "tau": 0.75,
        "order": 4,
        "symbol": "rotation-4-1",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M1.41,-9.39 L-5.77,-16.57 L-7.25,-15.09 L-0.07,-7.9 Z M-9.39,-1.41 L-16.57,5.77 L-15.09,7.25 L-7.9,0.07 Z M-1.41,9.39 L5.77,16.57 L7.25,15.09 L0.07,7.9 Z M9.39,1.41 L16.57,-5.77 L15.09,-7.25 L7.9,-0.07 Z",
        "sourcePlatePosition": [
          360.0,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          -0.5,
          -0.5
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "3/4",
        "timeShiftLabel": "+3/4 period",
        "tau": 0.75,
        "order": 4,
        "symbol": "rotation-4-1",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M1.41,-9.39 L-5.77,-16.57 L-7.25,-15.09 L-0.07,-7.9 Z M-9.39,-1.41 L-16.57,5.77 L-15.09,7.25 L-7.9,0.07 Z M-1.41,9.39 L5.77,16.57 L7.25,15.09 L0.07,7.9 Z M9.39,1.41 L16.57,-5.77 L15.09,-7.25 L7.9,-0.07 Z",
        "sourcePlatePosition": [
          286.4,
          283.6
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          0.0,
          -0.5
        ],
        "angleDegrees": 180,
        "operationIndex": 0,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 2,
        "symbol": "rotation-2-1",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z M0.3,-9.2 L1.24,-10.27 L2.28,-11.24 L3.41,-12.1 L4.62,-12.85 L5.9,-13.48 L7.23,-13.99 L8.6,-14.36 L8.15,-16.41 L6.58,-15.98 L5.06,-15.41 L3.6,-14.69 L2.22,-13.83 L0.93,-12.84 L-0.26,-11.74 L-1.34,-10.52 Z M-0.3,9.2 L-1.24,10.27 L-2.28,11.24 L-3.41,12.1 L-4.62,12.85 L-5.9,13.48 L-7.23,13.99 L-8.6,14.36 L-8.15,16.41 L-6.58,15.98 L-5.06,15.41 L-3.6,14.69 L-2.22,13.83 L-0.93,12.84 L0.26,11.74 L1.34,10.52 Z",
        "sourcePlatePosition": [
          360.0,
          283.6
        ]
      }
    ]
  },
  "g97": {
    "id": "g97",
    "shortText": "⁴4⁴4²2",
    "shortHTML": "<sup>4</sup>4<sup>4</sup>4<sup>2</sup>2",
    "clockOrder": 4,
    "signatureStatus": "rule-extension",
    "signatureEvidence": "The book does not enumerate composite C4 colourings. This short signature is derived from its rule: replace each generator permutation by its order.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g97",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.0
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          0.0
        ],
        "timeShift": "1/4",
        "timeShiftLabel": "+1/4 period",
        "tau": 0.25,
        "order": 4,
        "symbol": "rotation-4-3",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-7.9,-0.07 L-15.09,-7.25 L-16.57,-5.77 L-9.39,1.41 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z M7.9,0.07 L15.09,7.25 L16.57,5.77 L9.39,-1.41 Z",
        "sourcePlatePosition": [
          360.0,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          -0.5,
          -0.5
        ],
        "angleDegrees": 270,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "1/4",
        "timeShiftLabel": "+1/4 period",
        "tau": 0.25,
        "order": 4,
        "symbol": "rotation-4-3",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-7.9,-0.07 L-15.09,-7.25 L-16.57,-5.77 L-9.39,1.41 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z M7.9,0.07 L15.09,7.25 L16.57,5.77 L9.39,-1.41 Z",
        "sourcePlatePosition": [
          286.4,
          283.6
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          0.0,
          -0.5
        ],
        "angleDegrees": 180,
        "operationIndex": 0,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          0.0,
          -1.0
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 2,
        "symbol": "rotation-2-1",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z M0.3,-9.2 L1.24,-10.27 L2.28,-11.24 L3.41,-12.1 L4.62,-12.85 L5.9,-13.48 L7.23,-13.99 L8.6,-14.36 L8.15,-16.41 L6.58,-15.98 L5.06,-15.41 L3.6,-14.69 L2.22,-13.83 L0.93,-12.84 L-0.26,-11.74 L-1.34,-10.52 Z M-0.3,9.2 L-1.24,10.27 L-2.28,11.24 L-3.41,12.1 L-4.62,12.85 L-5.9,13.48 L-7.23,13.99 L-8.6,14.36 L-8.15,16.41 L-6.58,15.98 L-5.06,15.41 L-3.6,14.69 L-2.22,13.83 L-0.93,12.84 L0.26,11.74 L1.34,10.52 Z",
        "sourcePlatePosition": [
          360.0,
          283.6
        ]
      }
    ]
  },
  "g98": {
    "id": "g98",
    "shortText": "¹4²4²2",
    "shortHTML": "<sup>1</sup>4<sup>2</sup>4<sup>2</sup>2",
    "clockOrder": 2,
    "signatureStatus": "type-representative",
    "signatureEvidence": "Table 11.1 groups 2 equivalent generator signatures under the same colour type 442/442. The page uses the first printed short signature as a stable representative; the G/K type, not this choice of generators, is the invariant correspondence.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g98",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.0
        ],
        "angleDegrees": 270,
        "operationIndex": 4,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          0.0,
          0.0
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 4,
        "symbol": "rotation-4-0",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z",
        "sourcePlatePosition": [
          360.0,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          0.0,
          0.5
        ],
        "angleDegrees": 270,
        "operationIndex": 5,
        "matrix": [
          [
            0,
            1
          ],
          [
            -1,
            0
          ]
        ],
        "translation": [
          -0.5,
          0.5
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 4,
        "symbol": "rotation-4-2",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z",
        "sourcePlatePosition": [
          360.0,
          103.98
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          -0.25,
          0.25
        ],
        "angleDegrees": 180,
        "operationIndex": 1,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          -0.5,
          0.5
        ],
        "timeShift": "1/2",
        "timeShiftLabel": "+1/2 period",
        "tau": 0.5,
        "order": 2,
        "symbol": "rotation-2-1",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z M0.3,-9.2 L1.24,-10.27 L2.28,-11.24 L3.41,-12.1 L4.62,-12.85 L5.9,-13.48 L7.23,-13.99 L8.6,-14.36 L8.15,-16.41 L6.58,-15.98 L5.06,-15.41 L3.6,-14.69 L2.22,-13.83 L0.93,-12.84 L-0.26,-11.74 L-1.34,-10.52 Z M-0.3,9.2 L-1.24,10.27 L-2.28,11.24 L-3.41,12.1 L-4.62,12.85 L-5.9,13.48 L-7.23,13.99 L-8.6,14.36 L-8.15,16.41 L-6.58,15.98 L-5.06,15.41 L-3.6,14.69 L-2.22,13.83 L-0.93,12.84 L0.26,11.74 L1.34,10.52 Z",
        "sourcePlatePosition": [
          306.99,
          156.99
        ]
      }
    ]
  },
  "g99": {
    "id": "g99",
    "shortText": "⁴4⁴4¹2",
    "shortHTML": "<sup>4</sup>4<sup>4</sup>4<sup>1</sup>2",
    "clockOrder": 4,
    "signatureStatus": "rule-extension",
    "signatureEvidence": "The book does not enumerate composite C4 colourings. This short signature is derived from its rule: replace each generator permutation by its order.",
    "sourceUrl": "https://yaroslavvb.github.io/animated-groups-fable/correspondence-p4.html#g99",
    "namedGenerators": [
      {
        "name": "α",
        "geometry": "quarter-turn",
        "centre": [
          -0.25,
          0.0
        ],
        "angleDegrees": 90,
        "operationIndex": 3,
        "matrix": [
          [
            0,
            -1
          ],
          [
            1,
            0
          ]
        ],
        "translation": [
          -0.25,
          0.25
        ],
        "timeShift": "1/4",
        "timeShiftLabel": "+1/4 period",
        "tau": 0.25,
        "order": 4,
        "symbol": "rotation-4-1",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M1.41,-9.39 L-5.77,-16.57 L-7.25,-15.09 L-0.07,-7.9 Z M-9.39,-1.41 L-16.57,5.77 L-15.09,7.25 L-7.9,0.07 Z M-1.41,9.39 L5.77,16.57 L7.25,15.09 L0.07,7.9 Z M9.39,1.41 L16.57,-5.77 L15.09,-7.25 L7.9,-0.07 Z",
        "sourcePlatePosition": [
          306.62,
          210.0
        ]
      },
      {
        "name": "β",
        "geometry": "quarter-turn",
        "centre": [
          0.25,
          0.0
        ],
        "angleDegrees": 90,
        "operationIndex": 2,
        "matrix": [
          [
            0,
            -1
          ],
          [
            1,
            0
          ]
        ],
        "translation": [
          0.25,
          -0.25
        ],
        "timeShift": "3/4",
        "timeShiftLabel": "+3/4 period",
        "tau": 0.75,
        "order": 4,
        "symbol": "rotation-4-3",
        "path": "M0,-10.8 L-10.8,0 L0,10.8 L10.8,0 Z M0.07,-7.9 L7.25,-15.09 L5.77,-16.57 L-1.41,-9.39 Z M-7.9,-0.07 L-15.09,-7.25 L-16.57,-5.77 L-9.39,1.41 Z M-0.07,7.9 L-7.25,15.09 L-5.77,16.57 L1.41,9.39 Z M7.9,0.07 L15.09,7.25 L16.57,5.77 L9.39,-1.41 Z",
        "sourcePlatePosition": [
          413.38,
          210.0
        ]
      },
      {
        "name": "γ",
        "geometry": "half-turn",
        "centre": [
          0.0,
          -0.25
        ],
        "angleDegrees": 180,
        "operationIndex": 0,
        "matrix": [
          [
            -1,
            0
          ],
          [
            0,
            -1
          ]
        ],
        "translation": [
          0.0,
          -0.5
        ],
        "timeShift": "0",
        "timeShiftLabel": "none",
        "tau": 0,
        "order": 2,
        "symbol": "rotation-2-0",
        "path": "M0,-12 A16.81,16.81 0 0 0 0,12 A16.81,16.81 0 0 0 0,-12 Z",
        "sourcePlatePosition": [
          360.0,
          263.38
        ]
      }
    ]
  }
};

const mod = (x, n = 1) => ((x % n) + n) % n;
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function generatorDescription(generator) {
  const turn = generator.order === 2 ? 'half-turn' : `quarter-turn ${generator.angleDegrees === 270 ? 'counterclockwise' : 'clockwise'}`;
  return `${generator.name}: ${turn}; ${generator.tau ? `+${generator.timeShift} period` : 'no time shift'}`;
}

/** Named centres and their spatial-lattice translates, in SVG pixel units. */
export function generatorPlacements(groupId, {tiles = 2, width = 768, height = width} = {}) {
  const group = GROUP_DISPLAY[groupId];
  if (!group) throw new Error(`Unknown 442 group: ${groupId}`);
  if (!Number.isInteger(tiles) || tiles < 1 || tiles > 16) throw new Error('tiles must be an integer between 1 and 16.');
  if (!(width > 0 && height > 0)) throw new Error('Overlay dimensions must be positive.');
  const result = [];
  for (const generator of group.namedGenerators) {
    const x0 = mod(generator.centre[0]), y0 = mod(generator.centre[1]);
    for (let iy = 0; iy + y0 <= tiles; iy++) {
      for (let ix = 0; ix + x0 <= tiles; ix++) {
        result.push({...generator, x:(x0+ix)*width/tiles, y:(y0+iy)*height/tiles, tileX:ix, tileY:iy});
      }
    }
  }
  return result;
}

/** SVG contents, useful with either the browser DOM or a static renderer. */
export function generatorMarkup(groupId, {tiles = 2, width = 768, height = width, selected = null, interactive = true, labels = true, glyphScale = 1} = {}) {
  const placements = generatorPlacements(groupId, {tiles,width,height});
  const scaled = Number.isFinite(glyphScale) && glyphScale > 0 ? glyphScale : 1;
  const contents = placements.map(g => {
    const active = selected === g.name;
    const description = generatorDescription(g);
    const labelX = Math.max(14,Math.min(width-14,g.x+(g.x>width-48?-25:25)*scaled));
    const labelY = Math.max(16,Math.min(height-16,g.y+(g.y<35?25:-24)*scaled));
    return `<g class="sg-generator${active?' is-selected':''}" data-generator="${g.name}" data-operation-index="${g.operationIndex}" data-time-shift="${g.timeShift}" data-generator-symbol="${g.symbol}"${interactive?` role="button" tabindex="0" aria-label="${escape(description)}" aria-pressed="${active}"`:''}><title>${escape(description)}</title><circle class="sg-generator-hit" cx="${g.x}" cy="${g.y}" r="${24*scaled}"/><path class="sg-generator-glyph generator-symbol-core" transform="translate(${g.x} ${g.y}) scale(${scaled})" d="${g.path}"/>${labels?`<text class="sg-generator-label" x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central">${g.name}</text>`:''}</g>`;
  }).join('');
  return contents;
}

/** Re-render only when group, tiling, or selection changes, not every frame. */
export function renderGeneratorOverlay(svg, {groupId, tiles = 2, selected = null, onSelect = null, width = 768, height = width, labels = true, glyphScale = 1} = {}) {
  if (!svg || typeof svg.setAttribute !== 'function') throw new Error('Expected an SVG element.');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('role','group');
  svg.setAttribute('aria-label',`Named generators for ${GROUP_DISPLAY[groupId]?.shortText || groupId}`);
  svg.classList.add('sg-generator-overlay');
  svg.innerHTML = generatorMarkup(groupId,{tiles,width,height,selected,interactive:typeof onSelect==='function',labels,glyphScale});
  const activate = target => {
    const marker = target.closest?.('[data-generator]');
    if (!marker || !svg.contains(marker) || typeof onSelect !== 'function') return;
    onSelect(GROUP_DISPLAY[groupId].namedGenerators.find(g => g.name === marker.dataset.generator));
  };
  svg.onclick = event => activate(event.target);
  svg.onkeydown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.closest?.('[data-generator]')) return;
    event.preventDefault();
    activate(event.target);
  };
  return GROUP_DISPLAY[groupId];
}
