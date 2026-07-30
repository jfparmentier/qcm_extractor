#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("Le paquet 'jsonschema' est requis : python -m pip install jsonschema", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate_file(instance_path: Path, schema_path: Path) -> None:
    instance = load(instance_path)
    schema = load(schema_path)
    errors = sorted(Draft202012Validator(schema).iter_errors(instance), key=lambda e: list(e.path))
    if errors:
        for error in errors:
            location = '/'.join(str(p) for p in error.path) or '<racine>'
            print(f"ERREUR {instance_path}: {location}: {error.message}")
        raise SystemExit(1)
    print(f"OK {instance_path.relative_to(ROOT)}")


def check_bbox(bbox, label):
    if bbox['x'] + bbox['width'] > 1.000001 or bbox['y'] + bbox['height'] > 1.000001:
        raise AssertionError(f"Boîte hors page: {label}: {bbox}")


def check_question(question, label):
    choice_ids = [c['id'] for c in question['choices']]
    assert len(choice_ids) == len(set(choice_ids)), f"Choix dupliqués: {label}"
    assert set(question['correct_choice_ids']).issubset(choice_ids), f"Réponse vers choix inexistant: {label}"
    asset_ids = {img['id'].removeprefix('asset-') for img in question.get('images', [])}
    for token in [part.split(')', 1)[0] for part in question['statement'].split('(asset:')[1:]]:
        assert token in asset_ids, f"Ressource absente dans l’énoncé: {label}: {token}"
    for img in question.get('images', []):
        check_bbox(img['bbox'], f"{label}/{img['id']}")


validate_file(ROOT / 'examples/mapping.example.json', ROOT / 'schemas/mapping.schema.json')
validate_file(ROOT / 'examples/extraction.example.json', ROOT / 'schemas/extraction.schema.json')
validate_file(ROOT / 'examples/extraction.multiple-choice.example.json', ROOT / 'schemas/extraction.schema.json')
validate_file(ROOT / 'examples/export.example.json', ROOT / 'schemas/export.schema.json')
validate_file(ROOT / 'golden/golden-dataset.json', ROOT / 'schemas/golden-dataset.schema.json')

golden = load(ROOT / 'golden/golden-dataset.json')
assert len(golden['cases']) == 20, "Le corpus doit contenir exactement 20 cas pour la version 1.0.0."
assert len({c['case_id'] for c in golden['cases']}) == 20, "Identifiants de cas dupliqués."

for case in golden['cases']:
    seg = case['mapping_fragment']
    q = case['expected_question']
    assert q['segment_id'] == seg['temporary_id'], f"Segment incohérent: {case['case_id']}"
    assert set(q['source_pages']) == set(seg['question_pages']), f"Pages incohérentes: {case['case_id']}"
    for r in seg['page_regions']:
        check_bbox(r['bbox'], f"{case['case_id']}/{r['role']}")
    check_question(q, case['case_id'])

print('OK contrôles métier complémentaires')
