<?php

if (isset($_GET['game']) && gameExists($_GET['game'])) {
    $game = $_GET['game'];
    include('joingame.php');
    exit();
}

// Game does not exist.
if (isset($_GET['game'])) {
    header('location:' . WEB_ROOT);
    exit();
}

include('newgame.php');
exit();
