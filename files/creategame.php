<?php
$game = generateRandomString(10);

while (gameExists($game)) {
    $game = generateRandomString(10);
}

$db = getDB();
$sql = 'INSERT INTO games (game, status, data) values (:game, :status, :data)';
$stmt = $db->prepare($sql);
$stmt->bindValue(':game', $game, PDO::PARAM_STR);
$stmt->bindValue(':status', 'lobby', PDO::PARAM_STR);
$stmt->bindValue(':data', json_encode(json_decode('{}')), PDO::PARAM_STR);
$stmt->execute();

header('location:' . WEB_ROOT . $game . '');
exit();
