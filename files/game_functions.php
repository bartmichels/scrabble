<?php

/***********************************
 * General code.
 ***********************************/

function getSQLTime() {
    try {
         $db = getDB();
         $sql = 'SELECT NOW(6) as time';
         $stmt = $db->prepare($sql);
         $stmt->execute();
         $result = $stmt->fetch(PDO::FETCH_ASSOC);
         return $result['time'];
    } catch (PDOException $e) {
         error_log($e->getMessage());
         exit();
    }
}

function gameExists($game) {
    if (strlen($game) > 10) {
        return false;
    }
    try {
        $db = getDB();
        $sql = 'SELECT COUNT(game) as count FROM games WHERE game = :game';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->execute();
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($data['count'] == 1) {
            return true;
        } else {
            return false;
        }
    } catch (PDOException $e) {
      error_log($e->getMessage());
      exit();
    }
}

// Used for game id generation. Doesn't need to be secure.
function generateRandomString($length) {
    return substr(str_shuffle(str_repeat($x='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', ceil($length/strlen($x)) )), 1, $length);
}

function getPlayers($game) {
    try {
        $db = getDB();
        $sql = 'SELECT player_id, name, ready FROM players WHERE game = :game AND deleted = false ORDER BY player_id ASC';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->execute();
        $players = $stmt->fetchAll(PDO::FETCH_OBJ);
        foreach ($players as $key=>$player) {
            $players[$key]->player_id = intval($players[$key]->player_id);
        }
        return $players;
    } catch (PDOException $e) {
      error_log($e->getMessage());
      exit();
    }
}

function getGameStatus($game) {
    try {
        $db = getDB();
        $sql = 'SELECT status FROM games WHERE game = :game LIMIT 1';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['status'];
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
}

function setGameStatus($game, $status) {
    try {
        $db = getDB();
        $sql = 'UPDATE games SET status = :status WHERE game = :game';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':status', $status, PDO::PARAM_STR);
        $stmt->execute();
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
}

function getGameData($game) {
    try {
        $db = getDB();
        $sql = 'SELECT data FROM games WHERE game = :game LIMIT 1';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return json_decode($result['data']);
    } catch (PDOException $e) {
        error_log($e->getMessage());
      exit();
    }
}

function setGameData($game, $data) {
    try {
        $db = getDB();
        $sql = 'UPDATE games SET data = :data WHERE game = :game LIMIT 1';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':data', json_encode($data), PDO::PARAM_STR);
        if ($stmt->execute()) {
            return true;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
      exit();
    }
    return false;
}

/***********************************
 * Player join code.
 ***********************************/

function isValidPlayerName($game, $name) {
    if (strlen($name) > 20 || strlen($name) == 0) {
        return false;
    }
    try {
        $db = getDB();
        $sql = 'SELECT COUNT(name) as count FROM players WHERE game = :game AND name = :name AND deleted = false';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':name', $name, PDO::PARAM_STR);
        $stmt->execute();
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($data['count'] == 1) {
            return false;
        } else {
            return true;
        }
    } catch (PDOException $e) {
      error_log($e->getMessage());
      exit();
    }
}

function isValidPlayerId($game, $player_id) {
    try {
        $db = getDB();
        $sql = 'SELECT COUNT(game) as count FROM players WHERE game = :game AND player_id = :player_id AND deleted = false';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':player_id', $player_id, PDO::PARAM_INT);
        $stmt->execute();
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($data['count'] == 1) {
            return true;
        } else {
            return false;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
        exit();
    }
}

function createPlayer($game, $name) {
    try {
        $db = getDB();
        $sql = 'INSERT INTO players (game, name) VALUES (:game, :name)';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':name', $name, PDO::PARAM_STR);
        $stmt->execute();
        return $db->lastInsertId();
    } catch (PDOException $e) {
        error_log($e->getMessage());
        exit();
    }
}


/***********************************
 * Lobby code.
 ***********************************/
 
function deletePlayer($game, $player_id) {
    try {
        $db = getDB();
        $sql = 'UPDATE players SET deleted = true WHERE game = :game AND player_id = :player_id';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':player_id', $player_id, PDO::PARAM_INT);
        if ($stmt->execute()) {
            return true;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
    return false;
}

function lobbyPlayerWait($game, $player_id) {
    try {
        $db = getDB();
        $sql = 'UPDATE players SET ready = false WHERE game = :game AND player_id = :player_id';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':player_id', $player_id, PDO::PARAM_INT);
        if ($stmt->execute()) {
            return true;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
    return false;
}

function lobbyPlayerReady($game, $player_id) {
    try {
        $db = getDB();
        $sql = 'UPDATE players SET ready = true WHERE game = :game AND player_id = :player_id';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':player_id', $player_id, PDO::PARAM_INT);
        if ($stmt->execute()) {
            return true;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
    return false;
}

function lobbyArePlayersReady($game) {
    try {
        $db = getDB();
        $sql = 'SELECT COUNT(game) AS count FROM players WHERE game = :game AND ready = false AND deleted = false';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->execute();
        if ($stmt->fetch()['count'] == 0) {
            return true;
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
    }
    return false;
}

/***********************************
 * Game code.
 ***********************************/

function setupGame($game) {
    $gameData = newGameData($game);
    setGameStatus($game, 'setup');
    setGameData($game, $gameData);
    
    $gameMessage = new stdClass();
    $gameMessage->type = 'setup game';
    $gameMessage->gameData = $gameData;
    addMessage($game, $gameMessage);
}

function startGame($game) {
}

function newGameData($game) {
    global $allLetters;
    $data = new stdClass();
    $data->status = 'setup';
    $data->players = getPlayers($game);
    $data->startingPlayer = -1;
    $data->activePlayer = -1;
    $data->verifyingPlayer = -1;
    $data->bag = $allLetters;
    $data->totalLetters = count($allLetters);
    $data->playerLetters = new stdClass();
    $data->playerRankLetters = new stdClass();
    $data->rankLetterPlayers = array();
    $data->rankLetterRound = 0;
    $data->rankLetterWinners = array();
    $data->idlePlayerLetters = new stdClass();
    $data->usedPlayerLetters = new stdClass();
    $data->oldTiles = array();
    $data->scoreboard = new stdClass();
    $data->minusPoints = new stdClass();
    $data->scoreTotals = new stdClass();
    foreach ($data->players as $j => $player) {
        $letters = [];
        for ($i = 0; $i < 7; $i++) {
            array_push($letters, drawLetter($data->bag));
        }
        $data->playerLetters->{$player->player_id} = $letters;
        $data->playerRankLetters->{$player->player_id} = array();
        $data->idlePlayerLetters->{$player->player_id} = $letters;
        $data->usedPlayerLetters->{$player->player_id} = array();
        array_push($data->rankLetterPlayers, $player->player_id);
        $data->players[$j]->skip = false;
        $data->scoreboard->{$player->player_id} = array();
        $data->minusPoints->{$player->player_id} = 0;
        $data->scoreTotals->{$player->player_id} = 0;
    }
    $data->squaresFree = array();
    for ($i = 0; $i < 15; $i++) {
        $data->squaresFree[$i] = array_fill(0, 15, true);
    }
    $data->oldTiles = array();
    return $data;
}

function drawLetter(&$bag) {
    if (count($bag) > 0) {
        $index = rand(0, count($bag) - 1);
        return array_splice($bag, $index, 1, [])[0];
    }
    return false;
}

function putLetterInBag(&$bag, $letter) {
    array_push($bag, $letter);
}

function getPlayerName($players, $player_id) {
    for ($i = 0; $i < count($players); $i++) {
        $player = $players[$i];
        if ($player->player_id == $player_id) {
            return $player->name;
        }
    }
}

function setActivePlayer(&$gameData, $player_id) {
    $gameData->activePlayer = $player_id;
    $gameData->verifyingPlayer = getNextUnskippedPlayer($gameData->players, $player_id);
}

function getNextUnskippedPlayer($players, $player_id) {
    $playerIndex = getPlayerIndex($player_id, $players);
    for ($i = $playerIndex + 1; true; $i++) {
        $index = $i % count($players);
        if (!$players[$index]->skip) {
            return $players[$index]->player_id;
        }
    }
}

function addZeroScores(&$scoreboard, $players, $fromIndex) {
    $skipped = true;
    $index = $fromIndex - 1;
    while ($skipped) {
        $index = ($index + 1) % count($players);
        $player = $players[$index];
        $skipped = $player->skip;
        if ($skipped) {
            array_push($scoreboard->{$player->player_id}, 0);
        }
    }
}

function isValidMove($newLetters, $oldLetters) {
    // Check if all new letters are on one row or column. Return false if not.
    // If yes, get direction as well as start and end.
    if (count($newLetters) == 1) {
        $direction = 'row';
        $row = $newLetters[0]->square->row;
        $start = $end = $newLetters[0]->square->column;
    } else {
        // At least two letters. Check if first two have same row or column.
        if ($newLetters[0]->square->row == $newLetters[1]->square->row) {
            $direction = 'row';
            $row = $newLetters[0]->square->row;
            $start = min($newLetters[0]->square->column, $newLetters[1]->square->column);
            $end = max($newLetters[0]->square->column, $newLetters[1]->square->column);
            for ($i = 2; $i < count($newLetters); $i++) {
                $start = min($start, $newLetters[$i]->square->column);
                $end = max($end, $newLetters[$i]->square->column);
                if ($newLetters[$i]->square->row != $row) {
                    return false;
                }
            }
        } else if ($newLetters[0]->square->column == $newLetters[1]->square->column) {
            $direction = 'column';
            $column = $newLetters[0]->square->column;
            $start = min($newLetters[0]->square->row, $newLetters[1]->square->row);
            $end = max($newLetters[0]->square->row, $newLetters[1]->square->row);
            for ($i = 2; $i < count($newLetters); $i++) {
                $start = min($start, $newLetters[$i]->square->row);
                $end = max($end, $newLetters[$i]->square->row);
                if ($newLetters[$i]->square->column != $column) {
                    return false;
                }
            }
        } else {
            return false;
        }
    }
    
    // Get positions of old tiles.
    $oldSquaresFree = array();
    for ($i = 0; $i < 15; $i++) {
        $oldSquaresFree[$i] = array_fill(0, 15, true);
    }
    foreach ($oldLetters as $tileData) {
        $oldSquaresFree[$tileData->square->row][$tileData->square->column] = false;
    }
    
    // Get positions of new tiles.
    $newSquaresFree = array();
    for ($i = 0; $i < 15; $i++) {
        $newSquaresFree[$i] = array_fill(0, 15, true);
    }
    foreach ($newLetters as $tileData) {
        $newSquaresFree[$tileData->square->row][$tileData->square->column] = false;
    }
    
    // Check if all squares between start and end are filled and if letters
    // touch at least one existing tile.
    $touching = false;
    if ($direction == 'row') {
        for ($i = $start; $i <= $end; $i++) {
            // Square must be occupied by new or old letter.
            if ($oldSquaresFree[$row][$i] && $newSquaresFree[$row][$i]) {
                return false;
            }
            // Count touch when square is occupied by new letter and adjacent
            // square by old letter.
            $touching = $touching || (!$newSquaresFree[$row][$i] && touchesOldTiles($row, $i, $oldSquaresFree));
        }
    } else if ($direction == 'column') {
        for ($i = $start; $i <= $end; $i++) {
            if ($oldSquaresFree[$i][$column] && $newSquaresFree[$i][$column]) {
                return false;
            }
            $touching = $touching || (!$newSquaresFree[$i][$column] && touchesOldTiles($i, $column, $oldSquaresFree));
        }
    }
    
    // If there are old letters, the word must touch them.
    if (count($oldLetters) > 0) {
        if (!$touching) {
            return false;
        }
    } else {
        // If there are no old letters, the midpoint must be occupied by a new
        // letter and the length must be at least 2.
        if ($newSquaresFree[7][7] || count($newLetters) == 1) {
            return false;
        }
    }
    
    // Letters lie in one line, with no gaps, and at least one new letter
    // touches an old one or the word covers the midpoint.
    return true;
}

function touchesOldTiles($row, $column, $oldSquaresFree) {
    if ($row >= 1 && !$oldSquaresFree[$row - 1][$column]) {
        return true;
    }
    if ($row <= 13 && !$oldSquaresFree[$row + 1][$column]) {
        return true;
    }
    if ($column >= 1 && !$oldSquaresFree[$row][$column - 1]) {
        return true;
    }
    if ($column <= 13 && !$oldSquaresFree[$row][$column + 1]) {
        return true;
    }
    return false;
}

function compareTileData($data1, $data2) {
    $square1 = $data1->square;
    $square2 = $data2->square;
    if ($square1->row > $square2->row) {
        return 1;
    }
    if ($square1->row < $square2->row) {
        return -1;
    }
    if ($square1->column > $square2->column) {
        return 1;
    }
    if ($square1->column < $square2->column) {
        return -1;
    }
    return 0;
}

// Result consists of array of word results, together with total value.
function getMoveResult($newLetters, $oldLetters) {
    $result = new stdClass();
    $wordsData = array();
    
    // Determine direction of main word.
    if (count($newLetters) == 1) {
        $direction = 'row';
    } else if ($newLetters[0]->square->row == $newLetters[1]->square->row) {
        $direction = 'row';
    } else {
        $direction = 'column';
    }
    
    // Sort new letters
    usort($newLetters, 'compareTileData');
    
    // Get all words
    if ($direction == 'row') {
        // Main word is in row
        $word = getRowWord($newLetters[0]->square, $newLetters, $oldLetters);
        if (count($word) > 1) {
            array_push($wordsData, $word);
        }
        // Other words in columns
        foreach ($newLetters as $tileData) {
            $word = getColumnWord($tileData->square, $newLetters, $oldLetters);
            if (count($word) > 1) {
                array_push($wordsData, $word);
            }
        }
    } else {
        // Main word is in column.
        $word = getColumnWord($newLetters[0]->square, $newLetters, $oldLetters);
        if (count($word) > 1) {
            array_push($wordsData, $word);
        }
        // Other words in rows
        foreach ($newLetters as $tileData) {
            $word = getRowWord($tileData->square, $newLetters, $oldLetters);
            if (count($word) > 1) {
                array_push($wordsData, $word);
            }
        }
    }
    
    // Get data for each word and sum values.
    $total = 0;
    $words = array();
    foreach ($wordsData as $wordData) {
        $wordResult = getWordResult($wordData);
        array_push($words, $wordResult);
        $total += $wordResult->total;
    }
    
    $bonus = 0;
    if (count($newLetters) == 7) {
        $bonus = 50;
    }
    
    $total += $bonus;
    
    $result->words = $words;
    $result->bonus = $bonus;
    $result->total = $total;
    return $result;
}

/**
 * Word is given as a list of tileData, in the order in which they form the
 * word. Result consists of array of letters with their corresponding value,
 * factor and total value, the value of the word and the word factor, as well as total value.
 */
function getWordResult($word) {
    global $letterValues;
    $result = new stdClass();
    $letters = array();
    $value = 0;
    $factor = 1;
    foreach ($word as $tileData) {
        $letterData = new stdClass();
        $letterData->letter = $tileData->letter;
        $letterData->value = $letterValues[$tileData->letter];
        // Get letter factor
        $letterData->factor = 1;
        if ($tileData->pending && isSquareLetter2x([$tileData->square->row, $tileData->square->column])) {
            $letterData->factor = 2;
        } else if ($tileData->pending && isSquareLetter3x([$tileData->square->row, $tileData->square->column])) {
            $letterData->factor = 3;
        }
        $letterData->total = $letterData->value * $letterData->factor;
        array_push($letters, $letterData);
        
        // Update word factor
        if ($tileData->pending && isSquareWord2x([$tileData->square->row, $tileData->square->column])) {
            $factor *= 2;
        } else if ($tileData->pending && isSquareWord3x([$tileData->square->row, $tileData->square->column])) {
            $factor *= 3;
        }
        // Update word value
        $value += $letterData->total;
    }
    
    $total = $value * $factor;
    
    $result->letters = $letters;
    $result->value = $value;
    $result->factor = $factor;
    $result->total = $total;
    return $result;
}

function getRowWord($square, $newLetters, $oldLetters) {
    $newLetters = array_filter($newLetters, function($tileData) use ($square) {
        return $tileData->square->row == $square->row;
    });
    $oldLetters = array_filter($oldLetters, function($tileData) use ($square) {
        return $tileData->square->row == $square->row;
    });
    $word = array();
    $passed = false;
    for ($i = 0; $i < 15; $i++) {
        // Check if tile is among new Letters
        $found = false;
        $matches = array_filter($newLetters, function($tileData) use ($i) {
            return $tileData->square->column == $i;
        });
        if (count($matches) > 0) {
            array_push($word, current($matches));
            $found = true;
        }
        // Check if tile is among old letters
        $matches = array_filter($oldLetters, function($tileData) use ($i) {
            return $tileData->square->column == $i;
        });
        if (count($matches) > 0) {
            array_push($word, current($matches));
            $found = true;
        }
        if ($i == $square->column) {
            $passed = true;
        }
        if (!$found) {
            // If not yet passed square, reset word.
            if (!$passed) {
                $word = array();
            } else {
                // Found the entire word
                return $word;
            }
        }
    }
    return $word;
}

function getColumnWord($square, $newLetters, $oldLetters) {
    $newLetters = array_filter($newLetters, function($tileData) use ($square) {
        return $tileData->square->column == $square->column;
    });
    $oldLetters = array_filter($oldLetters, function($tileData) use ($square) {
        return $tileData->square->column == $square->column;
    });
    $word = array();
    $passed = false;
    for ($i = 0; $i < 15; $i++) {
        // Check if tile is among new Letters
        $found = false;
        $matches = array_filter($newLetters, function($tileData) use ($i) {
            return $tileData->square->row == $i;
        });
        if (count($matches) > 0) {
            array_push($word, current($matches));
            $found = true;
        }
        // Check if tile is among old letters
        $matches = array_filter($oldLetters, function($tileData) use ($i) {
            return $tileData->square->row == $i;
        });
        if (count($matches) > 0) {
            array_push($word, current($matches));
            $found = true;
        }
        if ($i == $square->row) {
            $passed = true;
        }
        if (!$found) {
            // If not yet passed square, reset word.
            if (!$passed) {
                $word = array();
            } else {
                // Found the entire word
                return $word;
            }
        }
    }
    return $word;
}

function getPlayerIndex($player_id, $players) {
    for ($i = 0; $i < count($players); $i++) {
        if ($players[$i]->player_id == $player_id) {
            return $i;
        }
    }
    return -1;
}

function countUnskippedPlayers($players) {
    $count = 0;
    for ($i = 0; $i < count($players); $i++) {
        if (!$players[$i]->skip) {
            $count++;
        }
    }
    return $count;
}

$squaresLetter2x = [
    [0, 3], [0, 11],
    [2, 6], [2, 8],
    [3, 0], [3, 7], [3, 14],
    [6, 2], [6, 6], [6, 8], [6, 12],
    [7, 3], [7, 11],
    [8, 2], [8, 6], [8, 8], [8, 12],
    [11, 0], [11, 7], [11, 14],
    [12, 6], [12, 8],
    [14, 3], [14, 11]
];

$squaresLetter3x = [
    [1, 5], [1, 9],
    [5, 1], [5, 5], [5, 9], [5, 13],
    [9, 1], [9, 5], [9, 9], [9, 13],
    [13, 5], [13, 9]
];

$squaresWord2x = [
    [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [10, 10], [11, 11], [12, 12], [13, 13],
    [1, 13], [2, 12], [3, 11], [4, 10], [10, 4], [11, 3], [12, 2], [13, 1]
];

$squaresWord3x = [
    [0, 0], [0, 7], [0, 14],
    [7, 0], [7, 14],
    [14, 0], [14, 7], [14, 14]
];

$letterValues = array(
    'A' => 1,
    'B' => 3,
    'C' => 5,
    'D' => 2,
    'E' => 1,
    'F' => 4,
    'G' => 2,
    'H' => 4,
    'I' => 1,
    'J' => 8,
    'K' => 5,
    'L' => 1,
    'M' => 3,
    'N' => 1,
    'O' => 1,
    'P' => 3,
    'Q' => 10,
    'R' => 1,
    'S' => 1,
    'T' => 1,
    'U' => 1,
    'V' => 4,
    'W' => 4,
    'X' => 8,
    'Y' => 4,
    'Z' => 10,
    ' ' => 0
);

$letterQuantities = array(
    'A' => 9,
    'B' => 2,
    'C' => 2,
    'D' => 4,
    'E' => 12,
    'F' => 2,
    'G' => 3,
    'H' => 2,
    'I' => 9,
    'J' => 1,
    'K' => 1,
    'L' => 4,
    'M' => 2,
    'N' => 6,
    'O' => 8,
    'P' => 2,
    'Q' => 1,
    'R' => 6,
    'S' => 4,
    'T' => 6,
    'U' => 4,
    'V' => 2,
    'W' => 2,
    'X' => 1,
    'Y' => 2,
    'Z' => 1,
    ' ' => 2
);

$allLetters = [];
foreach ($letterQuantities as $letter=>$quantity) {
    for ($i = 0; $i < $quantity; $i++) {
        array_push($allLetters, $letter);
    }
}

function isSquareLetter2x($coords) {
    global $squaresLetter2x;
    return array_search($coords, $squaresLetter2x) !== false;
}

function isSquareLetter3x($coords) {
    global $squaresLetter3x;
    return array_search($coords, $squaresLetter3x) !== false;
}

function isSquareWord2x($coords) {
    global $squaresWord2x;
    return array_search($coords, $squaresWord2x) !== false;
}

function isSquareWord3x($coords) {
    global $squaresWord3x;
    return array_search($coords, $squaresWord3x) !== false;
}

function boardExtras($multiplier, $className) {
    $extraWidth = 11;
    $extraLength = 21;
    $extraOffset = [34, 25][$multiplier - 2];
    $space = [100 - 2 * $extraOffset - 2 * $extraWidth, (100 - 2 * $extraOffset - 3 * $extraWidth)/2][$multiplier - 2];
    for ($k = 0; $k < $multiplier; $k++) {
?>

        <div class="<?php echo $className;?>" style="position:absolute;height:<?php
        echo $extraLength;
        ?>%;width:<?php
        echo $extraWidth;
        ?>%;left:<?php
        echo $extraOffset + $k * ($extraWidth + $space);
        ?>%;top:<?php
        echo -$extraLength;
        ?>%;">
        </div>
        <div class="<?php echo $className;?>" style="position:absolute;height:<?php
        echo $extraLength;
        ?>%;width:<?php
        echo $extraWidth;
        ?>%;left:<?php
        echo $extraOffset + $k * ($extraWidth + $space);
        ?>%;top:<?php
        echo 100;
        ?>%;">
        </div>
        <div class="<?php echo $className;?>" style="position:absolute;width:<?php
        echo $extraLength;
        ?>%;height:<?php
        echo $extraWidth;
        ?>%;top:<?php
        echo $extraOffset + $k * ($extraWidth + $space);
        ?>%;left:<?php
        echo -$extraLength;
        ?>%;">
        </div>
        <div class="<?php echo $className;?>" style="position:absolute;width:<?php
        echo $extraLength;
        ?>%;height:<?php
        echo $extraWidth;
        ?>%;top:<?php
        echo $extraOffset + $k * ($extraWidth + $space);
        ?>%;left:<?php
        echo 100;
        ?>%;">
        </div>
<?php
    }
}
