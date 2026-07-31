<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/Autoload.php';

use QcmProxy\Application;
use QcmProxy\Operation;

Application::run(Operation::Extraction, dirname(__DIR__));
