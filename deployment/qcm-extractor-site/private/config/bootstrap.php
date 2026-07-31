<?php

declare(strict_types=1);

$configPath = __DIR__ . '/runtime.php';
if (!is_file($configPath)) {
    throw new RuntimeException('Le fichier private/config/runtime.php est absent.');
}

$runtimeConfig = require $configPath;
if (!is_array($runtimeConfig)) {
    throw new RuntimeException('La configuration serveur doit retourner un tableau PHP.');
}

foreach ($runtimeConfig as $name => $value) {
    if (!is_string($name) || !is_scalar($value)) {
        throw new RuntimeException('Une variable de configuration est invalide.');
    }

    $stringValue = (string) $value;
    // $_SERVER et $_ENV assurent le fonctionnement même si putenv() est désactivé
    // sur un hébergement mutualisé. putenv() reste utilisé lorsqu’il est disponible.
    $_SERVER[$name] = $stringValue;
    $_ENV[$name] = $stringValue;
    if (function_exists('putenv')) {
        @putenv($name . '=' . $stringValue);
    }
}

unset($runtimeConfig, $name, $value, $stringValue);
