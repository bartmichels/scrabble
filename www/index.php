<?php
// Entry point for all requests. Directs requests to different PHP scripts.
set_include_path(dirname($_SERVER['DOCUMENT_ROOT']) . '/files');
include 'db_config.php';
define('WEB_ROOT', '/');
include 'PHPSessionHandler.php';
include 'Token.php';
include 'LoginToken.php';
include 'passvalidation.php';
include 'session_config.php';
include 'start_session.php';
include 'game_functions.php';
$maxPlayers = 6;

// Log in.
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['action']) && $_POST['action'] == 'login') {
    if (verifyPassword($_POST['password'])) {
        (new LoginToken())->saveAsCookie();
        $_SESSION['ok'] = true;
    }
    header('location:' . $_SERVER['REQUEST_URI']);
    exit();
}

// Not logged in, show login form.
if ($_SERVER['REQUEST_METHOD'] == 'GET' && !isset($_SESSION['ok'])) {
    include("login.php");
    exit();
}

// Anything else requires to be logged in.
if (!isset($_SESSION['ok'])) {
    exit();
}

// View game.
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    include('game.php');
    exit();
}

// All other requests are POST with an action.
if (!($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['action']))) {
    exit();
}

// New game.
if ($_POST['action'] == 'newgame') {
    include('creategame.php');
    exit();
}

// Request game message.
if ($_POST['action'] == 'request_message') {
    include('messages.php');
    sendMessages($_POST['game'], $_POST['since']);
    exit();
}

// Send game message.
if ($_POST['action'] == 'send_message') {
    include('messages.php');
    handleGameMessage(json_decode($_POST['message']));
    exit();
}
