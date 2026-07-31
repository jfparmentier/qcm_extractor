<?php

declare(strict_types=1);

/**
 * Fichier à modifier AVANT la mise en ligne.
 * Il est protégé par private/.htaccess et doit rester hors de la racine publique.
 */
return [
    'OPENAI_API_KEY' => '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', // Renseigner la clé avant utilisation.

    // Le même domaine est autorisé automatiquement. Ces valeurs servent au mode Vite local.
    'QCM_ALLOWED_ORIGINS' => 'http://localhost:5173,http://127.0.0.1:5173',
    'QCM_ALLOW_ORIGINLESS_REQUESTS' => 'false',

    'QCM_OPENAI_MAPPING_MODEL' => 'gpt-5-mini',
    'QCM_OPENAI_EXTRACTION_MODEL' => 'gpt-5',
    'QCM_MAPPING_REASONING_EFFORT' => 'low',
    'QCM_EXTRACTION_REASONING_EFFORT' => 'medium',
    'QCM_TEXT_VERBOSITY' => 'low',

    'QCM_MAX_PDF_BYTES' => '26214400',
    'QCM_MAPPING_MAX_OUTPUT_TOKENS' => '12000',
    'QCM_EXTRACTION_MAX_OUTPUT_TOKENS' => '16000',
    'QCM_CONNECT_TIMEOUT_SECONDS' => '10',
    // Le délai cURL reste inférieur au plafond PHP afin que le proxy puisse renvoyer un JSON propre.
    'QCM_REQUEST_TIMEOUT_SECONDS' => '120',
    'QCM_PHP_MAX_EXECUTION_SECONDS' => '150',

    // Première passe asynchrone : les requêtes PHP restent courtes, même pour un PDF long.
    'QCM_BACKGROUND_START_TIMEOUT_SECONDS' => '25',
    'QCM_BACKGROUND_POLL_TIMEOUT_SECONDS' => '20',
    'QCM_BACKGROUND_POLL_INTERVAL_MS' => '2000',
    'QCM_BACKGROUND_JOB_TTL_SECONDS' => '900',

    // Compatible avec OVH mutualisé et MAMP, sans dépendre d’APCu.
    // Seuls de petits compteurs anonymisés sont écrits; les PDF ne sont jamais stockés.
    'QCM_RATE_LIMIT_BACKEND' => 'file',
    'QCM_RATE_LIMIT_STORAGE_DIR' => dirname(__DIR__) . '/runtime/rate-limit',
    // Limite standard appliquée sur le site public.
    'QCM_RATE_LIMIT_REQUESTS' => '10',
    // Limite distincte pour MAMP, uniquement si le client ET le nom d’hôte sont locaux.
    'QCM_RATE_LIMIT_LOCAL_REQUESTS' => '100',
    'QCM_RATE_LIMIT_WINDOW_SECONDS' => '3600',

    // Journal technique sans PDF, prompt ni clé API. Utile pour diagnostiquer MAMP/OVH.
    'QCM_DIAGNOSTIC_LOG_PATH' => dirname(__DIR__) . '/runtime/logs/qcm-proxy.log',
];
