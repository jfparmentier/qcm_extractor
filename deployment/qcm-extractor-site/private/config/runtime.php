<?php

declare(strict_types=1);

/**
 * Fichier à modifier AVANT la mise en ligne.
 * Il est protégé par private/.htaccess et doit rester hors de la racine publique.
 */
return [
    'OPENAI_API_KEY' => '', // Renseigner la clé avant utilisation.

    // Le même domaine est autorisé automatiquement. Ces valeurs servent au mode Vite local.
    'QCM_ALLOWED_ORIGINS' => 'http://localhost:5173,http://127.0.0.1:5173',
    'QCM_ALLOW_ORIGINLESS_REQUESTS' => 'false',

    'QCM_OPENAI_MAPPING_MODEL' => 'gpt-5',
    'QCM_OPENAI_EXTRACTION_MODEL' => 'gpt-5',

    'QCM_MAX_PDF_BYTES' => '26214400',
    'QCM_MAPPING_MAX_OUTPUT_TOKENS' => '12000',
    'QCM_EXTRACTION_MAX_OUTPUT_TOKENS' => '16000',
    'QCM_CONNECT_TIMEOUT_SECONDS' => '10',
    // Le délai cURL reste inférieur au plafond PHP afin que le proxy puisse renvoyer un JSON propre.
    'QCM_REQUEST_TIMEOUT_SECONDS' => '140',
    'QCM_PHP_MAX_EXECUTION_SECONDS' => '155',

    // Compatible avec OVH mutualisé et MAMP, sans dépendre d’APCu.
    // Seuls de petits compteurs anonymisés sont écrits; les PDF ne sont jamais stockés.
    'QCM_RATE_LIMIT_BACKEND' => 'file',
    'QCM_RATE_LIMIT_STORAGE_DIR' => dirname(__DIR__) . '/runtime/rate-limit',
    'QCM_RATE_LIMIT_REQUESTS' => '10',
    'QCM_RATE_LIMIT_WINDOW_SECONDS' => '3600',
];
