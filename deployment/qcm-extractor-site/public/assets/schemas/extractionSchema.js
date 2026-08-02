const extractionSchema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.invalid/qcm/schemas/extraction.schema.json",
    "title": "Extraction détaillée de QCM",
    "type": "object",
    "additionalProperties": false,
    "required": [
        "schema_version",
        "batch_id",
        "source_document",
        "questions",
        "missing_segment_ids",
        "warnings"
    ],
    "properties": {
        "schema_version": {
            "const": "1.0.0"
        },
        "batch_id": {
            "type": "string",
            "pattern": "^batch-[A-Za-z0-9._-]+$"
        },
        "source_document": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "title",
                "language"
            ],
            "properties": {
                "title": {
                    "type": "string"
                },
                "language": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 16
                }
            }
        },
        "questions": {
            "type": "array",
            "items": {
                "$ref": "#/$defs/question"
            }
        },
        "missing_segment_ids": {
            "type": "array",
            "uniqueItems": true,
            "items": {
                "type": "string",
                "pattern": "^segment-[A-Za-z0-9._-]+$"
            }
        },
        "warnings": {
            "type": "array",
            "uniqueItems": true,
            "items": {
                "type": "string"
            }
        }
    },
    "$defs": {
        "bbox": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "x",
                "y",
                "width",
                "height"
            ],
            "properties": {
                "x": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                },
                "y": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                },
                "width": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1
                },
                "height": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 1
                }
            },
            "description": "Boîte englobante normalisée dans le repère de la page, origine en haut à gauche. Les contraintes x+width<=1 et y+height<=1 sont contrôlées applicativement."
        },
        "provenanced_text": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "content",
                "origin"
            ],
            "properties": {
                "content": {
                    "type": "string",
                    "minLength": 1
                },
                "origin": {
                    "enum": [
                        "explicit_in_document",
                        "generated_by_model",
                        "provided_by_user"
                    ]
                }
            }
        },
        "choice": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "id",
                "content"
            ],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^choice-[A-Za-z0-9._-]+$"
                },
                "content": {
                    "type": "string",
                    "minLength": 1
                }
            }
        },
        "image": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "id",
                "role",
                "source_page",
                "bbox",
                "alt_text",
                "insertion_token"
            ],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^asset-[A-Za-z0-9._-]+$"
                },
                "role": {
                    "enum": [
                        "essential"
                    ]
                },
                "source_page": {
                    "type": "integer",
                    "minimum": 1
                },
                "bbox": {
                    "$ref": "#/$defs/bbox"
                },
                "alt_text": {
                    "type": "string"
                },
                "insertion_token": {
                    "type": "string",
                    "pattern": "^asset:[A-Za-z0-9._-]+$"
                }
            }
        },
        "question": {
            "type": "object",
            "additionalProperties": false,
            "required": [
                "id",
                "segment_id",
                "type",
                "title",
                "content_format",
                "statement",
                "choices",
                "correct_choice_ids",
                "correct_answer_origin",
                "feedback",
                "images",
                "source_pages",
                "confidence",
                "warnings",
                "status"
            ],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^q-[A-Za-z0-9._-]+$"
                },
                "segment_id": {
                    "type": "string",
                    "pattern": "^segment-[A-Za-z0-9._-]+$"
                },
                "type": {
                    "enum": [
                        "single_choice",
                        "multiple_choice",
                        "true_false"
                    ]
                },
                "title": {
                    "$ref": "#/$defs/provenanced_text"
                },
                "content_format": {
                    "const": "markdown-latex"
                },
                "statement": {
                    "type": "string",
                    "minLength": 1
                },
                "choices": {
                    "type": "array",
                    "minItems": 2,
                    "items": {
                        "$ref": "#/$defs/choice"
                    }
                },
                "correct_choice_ids": {
                    "type": "array",
                    "uniqueItems": true,
                    "items": {
                        "type": "string",
                        "pattern": "^choice-[A-Za-z0-9._-]+$"
                    }
                },
                "correct_answer_origin": {
                    "enum": [
                        "explicit_in_document",
                        "inferred_by_model",
                        "provided_by_user",
                        "not_available"
                    ]
                },
                "feedback": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "content",
                        "origin"
                    ],
                    "properties": {
                        "content": {
                            "type": "string",
                            "minLength": 1
                        },
                        "origin": {
                            "enum": [
                                "explicit_in_document",
                                "generated_by_model",
                                "provided_by_user"
                            ],
                            "type": "string"
                        }
                    }
                },
                "images": {
                    "type": "array",
                    "items": {
                        "$ref": "#/$defs/image"
                    }
                },
                "source_pages": {
                    "type": "array",
                    "minItems": 1,
                    "uniqueItems": true,
                    "items": {
                        "type": "integer",
                        "minimum": 1
                    }
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                },
                "warnings": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "uniqueItems": true
                },
                "status": {
                    "const": "draft"
                }
            },
            "allOf": [
                {
                    "if": {
                        "properties": {
                            "correct_answer_origin": {
                                "const": "not_available"
                            }
                        },
                        "type": "object"
                    },
                    "then": {
                        "properties": {
                            "correct_choice_ids": {
                                "maxItems": 0,
                                "type": "array"
                            }
                        },
                        "type": "object"
                    },
                    "else": {
                        "properties": {
                            "correct_choice_ids": {
                                "minItems": 1,
                                "type": "array"
                            }
                        },
                        "type": "object"
                    }
                },
                {
                    "if": {
                        "properties": {
                            "type": {
                                "const": "single_choice"
                            }
                        },
                        "type": "object"
                    },
                    "then": {
                        "properties": {
                            "correct_choice_ids": {
                                "maxItems": 1,
                                "type": "array"
                            }
                        },
                        "type": "object"
                    }
                },
                {
                    "if": {
                        "properties": {
                            "type": {
                                "const": "true_false"
                            }
                        },
                        "type": "object"
                    },
                    "then": {
                        "properties": {
                            "choices": {
                                "minItems": 2,
                                "maxItems": 2,
                                "type": "array"
                            },
                            "correct_choice_ids": {
                                "maxItems": 1,
                                "type": "array"
                            }
                        },
                        "type": "object"
                    }
                }
            ]
        }
    }
};
export default extractionSchema;
