<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__, 2) . '/private';
require $projectRoot . '/config/bootstrap.php';
require $projectRoot . '/src/Autoload.php';

use QcmProxy\Application;
use QcmProxy\Operation;

Application::run(Operation::Mapping, $projectRoot);
