<?php

declare(strict_types=1);

namespace QcmProxy;

enum Operation: string
{
    case Mapping = 'mapping';
    case Extraction = 'extraction';

    public function publicName(): string
    {
        return match ($this) {
            self::Mapping => 'analyze-map',
            self::Extraction => 'extract-questions',
        };
    }

    public function promptFile(): string
    {
        return match ($this) {
            self::Mapping => 'mapping.txt',
            self::Extraction => 'extraction.txt',
        };
    }

    public function schemaFile(): string
    {
        return match ($this) {
            self::Mapping => 'mapping.openai.schema.json',
            self::Extraction => 'extraction.openai.schema.json',
        };
    }

    public function responseFormatName(): string
    {
        return match ($this) {
            self::Mapping => 'qcm_document_mapping',
            self::Extraction => 'qcm_question_extraction',
        };
    }

    public function model(Config $config): string
    {
        return match ($this) {
            self::Mapping => $config->mappingModel,
            self::Extraction => $config->extractionModel,
        };
    }

    public function maxOutputTokens(Config $config): int
    {
        return match ($this) {
            self::Mapping => $config->mappingMaxOutputTokens,
            self::Extraction => $config->extractionMaxOutputTokens,
        };
    }
}
