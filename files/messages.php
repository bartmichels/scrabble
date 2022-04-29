<?php

function handleGameMessage($message) {
    global $maxPlayers;
    $game = $message->game;
    $player_id = $message->player_id;
    $returnMessage = new stdClass();
    $gameMessage = new stdClass();
    if (isset($message->ignoreId)) {
        $gameMessage->ignoreId = $message->ignoreId;
    }
    switch ($message->type) {
        case 'new player':
            $name = htmlspecialchars(trim($message->name));
            $players = getPlayers($game);
            $gameStatus = getGameStatus($game);
            if (count($players) < $maxPlayers && $gameStatus == 'lobby' && isValidPlayerName($game, $name)) {
                $returnMessage->status = 'ok';
                $returnMessage->player_id = createPlayer($game, $name);
                $gameMessage->type = 'new player';
                $gameMessage->player_id = $returnMessage->player_id;
                $gameMessage->name = $name;
            }
            break;
        case 'join':
            if (isValidPlayerId($game, $player_id)) {
                $returnMessage->status = 'ok';
            }
            break;
        case 'get data':
            $returnMessage = getGameData($game);
            $returnMessage->status = getGameStatus($game);
            $returnMessage->timestamp = getSQLTime();
            if (!isset($returnMessage->players)) {
                 $returnMessage->players = getPlayers($game);
            }
            break;
        case 'delete player':
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'lobby' && deletePlayer($game, $player_id)) {
                $gameMessage->type = 'delete player';
                $gameMessage->player_id = $player_id;
            }
            break;
        case 'player wait':
            if (lobbyPlayerWait($game, $player_id)) {
                $gameMessage->type = 'player wait';
                $gameMessage->player_id = $player_id;
            }
            break;
        case 'player ready':
            if (lobbyPlayerReady($game, $player_id)) {
                
                $gameMessage->type = 'player ready';
                $gameMessage->player_id = $player_id;
                
                $players = getPlayers($game);
                if (count($players) >= 2 && lobbyArePlayersReady($game)) {
                    setupGame($game);
                }
            }
            break;
        case 'draw rank letter':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'setup' &&
            array_search($player_id, $gameData->rankLetterPlayers) !== false &&
            !array_key_exists($gameData->rankLetterRound, $gameData->playerRankLetters->$player_id)) {
                $letter = drawLetter($gameData->bag);
                $gameData->playerRankLetters->$player_id[$gameData->rankLetterRound] = $letter;
                
                $gameMessage->type = 'rank letter';
                $gameMessage->player_id = $player_id;
                $gameMessage->letter = $letter;
                $gameMessage->round = $gameData->rankLetterRound;
                $gameMessage->bagTotal = count($gameData->bag);
                
                // Check if everyone has drawn
                $everyone = true;
                foreach ($gameData->rankLetterPlayers as $player_id) {
                    $everyone = $everyone && array_key_exists($gameData->rankLetterRound, $gameData->playerRankLetters->$player_id);
                }
                // Get winners
                if ($everyone) {
                    $winners = array();
                    $max = 0;
                    global $letterValues;
                    foreach ($gameData->rankLetterPlayers as $player_id) {
                        $value = $letterValues[$gameData->playerRankLetters->$player_id[$gameData->rankLetterRound]];
                        if ($value == $max) {
                            array_push($winners, $player_id);
                        } else if ($value > $max) {
                            $winners = [$player_id];
                            $max = $value;
                        }
                    }
                    $gameData->rankLetterWinners[$gameData->rankLetterRound] = $winners;
                    
                    $winnersMessage = new stdClass();
                    $winnersMessage->type = 'rank round winners';
                    $winnersMessage->winners = $winners;
                    $winnersMessage->round = $gameData->rankLetterRound;
                    addMessage($game, $winnersMessage);
                    
                    if (count($winners) > 1) {
                        // Do another round
                        $gameData->rankLetterPlayers = $winners;
                        $gameData->rankLetterRound++;
                    } else {
                        // Put rank letters in bag
                        foreach ($gameData->playerRankLetters as $letters) {
                            foreach ($letters as $letter) {
                                putLetterInBag($gameData->bag, $letter);
                            }
                        }
                        // Start game
                        setGameStatus($game, 'started');
                        $gameData->status = 'started';
                        $gameData->startingPlayer = $winners[0];
                        $gameData->isMoveSubmitted = false;
                        setActivePlayer($gameData, $winners[0]);
                        
                        $startGameMessage = new stdClass();
                        $startGameMessage->type = 'start game';
                        $startGameMessage->activePlayer = $winners[0];
                        $startGameMessage->playerName = getPlayerName($gameData->players, $winners[0]);
                        $startGameMessage->playerCount = count($gameData->players);
                        addMessage($game, $startGameMessage);
                    }
                }
                setGameData($game, $gameData);
            }
            break;
        case 'player skip':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started' && countUnskippedPlayers($gameData->players) > 2) {
                $index = getPlayerIndex($player_id, $gameData->players);
                if ($index != -1 && !$gameData->players[$index]->skip) {
                    $gameData->players[$index]->skip = true;
                    $oldUsedLetters = array();
                    if ($player_id == $gameData->activePlayer) {
                        $gameData->isMoveSubmitted = false;
                        setActivePlayer($gameData, $gameData->verifyingPlayer);
                        addZeroScores($gameData->scoreboard, $gameData->players, $index);
                        $oldUsedLetters = $gameData->usedPlayerLetters->$player_id;
                        foreach ($oldUsedLetters as $tileData) {
                            $gameData->squaresFree[$tileData->square->row][$tileData->square->column] = true;
                        }
                        $gameData->usedPlayerLetters->$player_id = array();
                        $gameData->idlePlayerLetters->$player_id = $gameData->playerLetters->$player_id;
                    } else if ($player_id == $gameData->verifyingPlayer) {
                        setActivePlayer($gameData, $gameData->activePlayer);
                    }
                    
                    setGameData($game, $gameData);
                    
                    $gameMessage->type = 'player skip';
                    $gameMessage->startingPlayer = $gameData->startingPlayer;
                    $gameMessage->players = $gameData->players;
                    $gameMessage->scoreboard = $gameData->scoreboard;
                    $gameMessage->playerName = $gameData->players[$index]->name;
                    $gameMessage->player_id = $player_id;
                    $gameMessage->activePlayer = $gameData->activePlayer;
                    $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                    $gameMessage->oldUsedLetters = $oldUsedLetters;
                    $gameMessage->totalLetters = count($gameData->playerLetters->$player_id);
                    $gameMessage->isMoveSubmitted = $gameData->isMoveSubmitted;
                }
            }
            break;
        case 'player unskip':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started') {
                $index = getPlayerIndex($player_id, $gameData->players);
                if ($index != -1 && $gameData->players[$index]->skip) {
                    $gameData->players[$index]->skip = false;
                    setActivePlayer($gameData, $gameData->activePlayer);
                    setGameData($game, $gameData);
                    
                    $gameMessage->type = 'player unskip';
                    $gameMessage->player_id = $player_id;
                    $gameMessage->players = $gameData->players;
                    $gameMessage->playerName = $gameData->players[$index]->name;;
                    $gameMessage->activePlayer = $gameData->activePlayer;
                    $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                    $gameMessage->isMoveSubmitted = $gameData->isMoveSubmitted;
                }
            }
            break;
        case 'place tile':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started' &&
            $gameData->activePlayer == $player_id &&
            array_search($message->letter, $gameData->idlePlayerLetters->$player_id) !== false &&
            $gameData->squaresFree[$message->square->row][$message->square->column]
            && !$gameData->isMoveSubmitted) {
                $gameData->squaresFree[$message->square->row][$message->square->column] = false;
                $tileData = new stdClass();
                $tileData->square = $message->square;
                $tileData->letter = $message->letter;
                $tileData->pending = true;
                $idleTileIndex = array_search($message->letter, $gameData->idlePlayerLetters->$player_id);
                array_splice($gameData->idlePlayerLetters->$player_id, $idleTileIndex, 1, []);
                array_push($gameData->usedPlayerLetters->$player_id, $tileData);
                setGameData($game, $gameData);
                
                $gameMessage->type = 'place tile';
                $gameMessage->tileData = $tileData;
                $gameMessage->squaresFree = $gameData->squaresFree;
                $gameMessage->player_id = $player_id;
                $gameMessage->idleTiles = $gameData->idlePlayerLetters->$player_id;
                $gameMessage->usedTiles = $gameData->usedPlayerLetters->$player_id;
            }
            break;
        case 'put tile back':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started' &&
            $gameData->activePlayer == $player_id &&
            !$gameData->isMoveSubmitted) {
                // Look for square among used player letters
                for ($i = 0; $i < count($gameData->usedPlayerLetters->$player_id); $i++) {
                    if ($gameData->usedPlayerLetters->$player_id[$i]->square->row == $message->square->row &&
                    $gameData->usedPlayerLetters->$player_id[$i]->square->column == $message->square->column) {
                        $letter = $gameData->usedPlayerLetters->$player_id[$i]->letter;
                        $square = $message->square;
                        $usedTileIndex = $i;
                    }
                }
                if (isset($square)) {
                    $gameData->squaresFree[$message->square->row][$message->square->column] = true;
                    array_splice($gameData->usedPlayerLetters->$player_id, $usedTileIndex, 1, []);
                    array_push($gameData->idlePlayerLetters->$player_id, $letter);
                    setGameData($game, $gameData);
                    
                    $gameMessage->type = 'put tile back';
                    $gameMessage->square = $square;
                    $gameMessage->squaresFree = $gameData->squaresFree;
                    $gameMessage->player_id = $player_id;
                    $gameMessage->idleTiles = $gameData->idlePlayerLetters->$player_id;
                    $gameMessage->usedTiles = $gameData->usedPlayerLetters->$player_id;
                }
            }
            break;
        case 'reject':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started') {
                // Put tiles back
                if ($gameData->activePlayer == $player_id && !$gameData->isMoveSubmitted) {
                    foreach ($gameData->usedPlayerLetters->$player_id as $tileData) {
                        $gameData->squaresFree[$tileData->square->row][$tileData->square->column] = true;
                    }
                    
                    $gameMessage->type = 'put tiles back';
                    $gameMessage->player_id = $player_id;
                    $gameMessage->totalLetters = count($gameData->playerLetters->$player_id);
                    $gameMessage->oldTiles = $gameData->usedPlayerLetters->$player_id;
                    $gameMessage->squaresFree = $gameData->squaresFree;
                    
                    $gameData->usedPlayerLetters->$player_id = array();
                    $gameData->idlePlayerLetters->$player_id = $gameData->playerLetters->$player_id;
                } else if ($gameData->activePlayer == $player_id && $gameData->isMoveSubmitted) {
                    // Cancel move
                    $gameData->isMoveSubmitted = false;
                    
                    $gameMessage->type = 'cancel move';
                    $gameMessage->activePlayer = $player_id;
                    $gameMessage->activePlayerName = $gameData->players[getPlayerIndex($player_id, $gameData->players)]->name;
                    $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                    $gameMessage->idleTiles = $gameData->idlePlayerLetters->$player_id;
                    $gameMessage->usedTiles = $gameData->usedPlayerLetters->$player_id;
                    $gameMessage->squaresFree = $gameData->squaresFree;
                } else if ($gameData->verifyingPlayer == $player_id && $gameData->isMoveSubmitted) {
                    // Reject move
                    $gameData->isMoveSubmitted = false;
                    
                    $gameMessage->type = 'reject move';
                    $gameMessage->activePlayer = $gameData->activePlayer;
                    $gameMessage->verifyingPlayerName = $gameData->players[getPlayerIndex($gameData->verifyingPlayer, $gameData->players)]->name;
                    $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                    $gameMessage->idleTiles = $gameData->idlePlayerLetters->{$gameData->activePlayer};
                    $gameMessage->usedTiles = $gameData->usedPlayerLetters->{$gameData->activePlayer};
                    $gameMessage->squaresFree = $gameData->squaresFree;
                }
                setGameData($game, $gameData);
            }
            break;
        case 'approve':
            $gameData = getGameData($game);
            $gameStatus = getGameStatus($game);
            if ($gameStatus == 'started') {
                // Submit move
                if ($gameData->activePlayer == $player_id &&
                !$gameData->isMoveSubmitted && count($gameData->usedPlayerLetters->$player_id) > 0) {
                    if (!isValidMove($gameData->usedPlayerLetters->$player_id, $gameData->oldTiles)) {
                        $gameMessage->type = 'invalid move';
                        $gameMessage->activePlayer = $player_id;
                        $gameMessage->usedTiles = $gameData->usedPlayerLetters->$player_id;
                        $gameMessage->idleTiles = $gameData->idlePlayerLetters->$player_id;
                        $gameMessage->squaresFree = $gameData->squaresFree;
                        addMessage($game, $gameMessage);
                    } else {
                        $gameData->isMoveSubmitted = true;
                        
                        $gameMessage->type = 'submit move';
                        $gameMessage->activePlayer = $player_id;
                        $gameMessage->activePlayerName = $gameData->players[getPlayerIndex($player_id, $gameData->players)]->name;
                        $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                        $gameMessage->usedTiles = $gameData->usedPlayerLetters->$player_id;
                        $gameMessage->idleTiles = $gameData->idlePlayerLetters->$player_id;
                        addMessage($game, $gameMessage);
                    }
                }
                // Verify move
                if ($gameData->verifyingPlayer == $player_id &&
                $gameData->isMoveSubmitted) {
                    $gameData->isMoveSubmitted = false;
                    $move = $gameData->usedPlayerLetters->{$gameData->activePlayer};
                    $oldBeforeMove = $gameData->oldTiles;
                    
                    // Update old tiles
                    foreach ($gameData->usedPlayerLetters->{$gameData->activePlayer} as $tileData) {
                        $oldTileData = new stdClass();
                        $oldTileData->square = $tileData->square;
                        $oldTileData->letter = $tileData->letter;
                        $oldTileData->pending = false;
                        array_push($gameData->oldTiles, $oldTileData);
                        
                        $gameMessage->type = 'place old letter';
                        $gameMessage->tileData = $oldTileData;
                        addMessage($game, $gameMessage);
                    }
                    $gameData->usedPlayerLetters->{$gameData->activePlayer} = array();
                    $gameData->playerLetters->{$gameData->activePlayer} = $gameData->idlePlayerLetters->{$gameData->activePlayer};
                    
                    // Give new tiles to player.
                    $add = min(count($gameData->bag), 7 - count($gameData->playerLetters->{$gameData->activePlayer}));
                    for ($i = 0; $i < $add; $i++) {
                        array_push($gameData->playerLetters->{$gameData->activePlayer}, drawLetter($gameData->bag));
                    }
                    $gameData->idlePlayerLetters->{$gameData->activePlayer} = $gameData->playerLetters->{$gameData->activePlayer};
                    
                    $gameMessage->type = 'letters after move';
                    $gameMessage->player_id = $gameData->activePlayer;
                    $gameMessage->letters = $gameData->playerLetters->{$gameData->activePlayer};
                    $gameMessage->bagTotal = count($gameData->bag);
                    addMessage($game, $gameMessage);
                    
                    // If player has no new tiles, game has ended.
                    
                    $ended = false;
                    if (count($gameData->playerLetters->{$gameData->activePlayer}) == 0) {
                        $ended = true;
                    }
                    
                    // Verification message
                    $gameMessage->type = 'verify move';
                    $gameMessage->ended = $ended;
                    $gameMessage->activePlayer = $gameData->activePlayer;
                    $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                    $gameMessage->verifyingPlayerName = $gameData->players[getPlayerIndex($gameData->verifyingPlayer, $gameData->players)]->name;
                    addMessage($game, $gameMessage);
                    
                    // Get result, update scoreboard.
                    $result = getMoveResult($move, $oldBeforeMove);
                    array_push($gameData->scoreboard->{$gameData->activePlayer}, $result->total);
                    // For skipped players after active player, add zero score unless game has ended
                    if (!$ended) {
                        addZeroScores($gameData->scoreboard, $gameData->players, getPlayerIndex($gameData->activePlayer, $gameData->players) + 1);
                    }
                    
                    $gameMessage->type = 'move result';
                    $gameMessage->result = $result;
                    $gameMessage->scoreboard = $gameData->scoreboard;
                    $gameMessage->players = $gameData->players;
                    $gameMessage->startingPlayer = $gameData->startingPlayer;
                    $gameMessage->activePlayerName = $gameData->players[getPlayerIndex($gameData->activePlayer, $gameData->players)]->name;
                    addMessage($game, $gameMessage);
                    
                    if (!$ended) {
                        setActivePlayer($gameData, $gameData->verifyingPlayer);
                    } else {
                        // game has ended
                        setGameStatus($game, 'ended');
                        $gameData->status = 'ended';
                        $gameData->activePlayer = -1;
                        $gameData->verifyingPlayer = -1;
                        global $letterValues;
                        
                        // Compute minus points
                        foreach ($gameData->players as $player) {
                            $minus = 0;
                            foreach ($gameData->playerLetters->{$player->player_id} as $letter) {
                                $minus += $letterValues[$letter];
                            }
                            $gameData->minusPoints->{$player->player_id} = $minus;
                        }
                        
                        // Compute score totals
                        foreach ($gameData->players as $player) {
                            $total = 0;
                            foreach ($gameData->scoreboard->{$player->player_id} as $score) {
                                $total += $score;
                            }
                            $gameData->scoreTotals->{$player->player_id} = $total - $gameData->minusPoints->{$player->player_id};
                        }
                        
                        // Send message.
                        $gameMessage->type = 'end game';
                        $gameMessage->startingPlayer = $gameData->startingPlayer;
                        $gameMessage->players = $gameData->players;
                        $gameMessage->scoreboard = $gameData->scoreboard;
                        $gameMessage->minusPoints = $gameData->minusPoints;
                        $gameMessage->scoreTotals = $gameData->scoreTotals;
                        $gameMessage->playerLetters = $gameData->playerLetters;
                        addMessage($game, $gameMessage);
                    }
                }
                $gameMessage = new stdClass();
                setGameData($game, $gameData);
            }
            break;
        case 'change tiles':
            $gameStatus = getGameStatus($game);
            $gameData = getGameData($game);
            if ($gameStatus == 'started' && $player_id == $gameData->activePlayer && !$gameData->isMoveSubmitted) {
                $gameData->isMoveSubmitted = false;
                // Draw 7 new letters, or less if there are not enough.
                $newLetters = array();
                $new = 0;
                for ($i = 0; $i < 7 && count($gameData->bag) > 0; $i++) {
                    $new ++;
                    array_push($newLetters, drawLetter($gameData->bag));
                }
                
                // For each old letter placed by player, set square to free and put it back in bag.
                foreach ($gameData->usedPlayerLetters->$player_id as $tileData) {
                    putLetterInBag($gameData->bag, $tileData->letter);
                    $gameData->squaresFree[$tileData->square->row][$tileData->square->column] = true;
                }
                
                // Remember old letters so that they can be removed client side.
                $oldUsedLetters = $gameData->usedPlayerLetters->$player_id;
                $gameData->usedPlayerLetters->$player_id = array();
                
                // For each idle letter, place it in bag.
                foreach ($gameData->idlePlayerLetters->$player_id as $letter) {
                    putLetterInBag($gameData->bag, $letter);
                }
                
                // Draw remaining new letters
                for ($i = 0; $i < 7 - $new && count($gameData->bag) > 0; $i++) {
                    array_push($newLetters, drawLetter($gameData->bag));
                }
                
                $gameData->idlePlayerLetters->$player_id = $newLetters;
                $gameData->playerLetters->$player_id = $newLetters;
                
                // Update scoreboard
                array_push($gameData->scoreboard->$player_id, 0);
                addZeroScores($gameData->scoreboard, $gameData->players, getPlayerIndex($player_id, $gameData->players) + 1);
                
                $gameMessage->type = 'change tiles';
                $gameMessage->activePlayer = $player_id;
                $gameMessage->activePlayerName = $gameData->players[getPlayerIndex($player_id, $gameData->players)]->name;
                $gameMessage->verifyingPlayer = $gameData->verifyingPlayer;
                $gameMessage->oldUsedLetters = $oldUsedLetters;
                $gameMessage->letters = $gameData->playerLetters->$player_id;
                $gameMessage->startingPlayer = $gameData->startingPlayer;
                $gameMessage->players = $gameData->players;
                $gameMessage->scoreboard = $gameData->scoreboard;
                $gameMessage->squaresFree = $gameData->squaresFree;
                $gameMessage->bagTotal = count($gameData->bag);
                
                // Update active player
                setActivePlayer($gameData, $gameData->verifyingPlayer);
                
                setGameData($game, $gameData);
            }
            break;
        case 'chat':
            $gameStatus = getGameStatus($game);
            $gameData = getGameData($game);
            $playerIndex = getPlayerIndex($message->player_id, $gameData->players);
            $length = strlen(trim($message->message));
            if (($gameStatus == 'setup' || $gameStatus == 'started' || $gameStatus == 'ended') && $length > 0 && $length <= 100 && $playerIndex != -1) {
                $pattern = '#https?://[^\s]+(?=(\s|$))#';
                $replacement = '<a href="$0" target="_blank">$0</a>';
                $message = preg_replace($pattern, $replacement, htmlentities(html_entity_decode($message->message)));
                
                $gameMessage->type = 'chat';
                $gameMessage->message = $message;
                $gameMessage->name = $gameData->players[$playerIndex]->name;
            }
            break;
    }
    if (isset($gameMessage->type)) {
        addMessage($game, $gameMessage);
    }
    header('Content-Type: application/json');
    echo json_encode($returnMessage);
    exit();
}

// Send messages as JSON array, oldest first.
function sendMessages($game, $since) {
    $data = new stdClass();
    $data->messages = array();
    try {
        $db = getDB();
        $sql = 'SELECT message, timestamp FROM messages WHERE game = :game AND timestamp > :since ORDER BY timestamp ASC';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':since', $since, PDO::PARAM_STR);
        $stmt->execute();
        $data->messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($data->messages as $i => $result) {
            $data->messages[$i] = json_decode($result['message']);
            $data->messages[$i]->timestamp = $result['timestamp'];
        }
    } catch (PDOException $e) {
        error_log($e->getMessage());
        exit();
    }
    header('Content-Type: application/json;charset=utf-8');
    echo json_encode($data);
    exit();
}

function addMessage($game, $message) {
    try {
        $db = getDB();
        $sql = 'INSERT INTO messages (game, message, timestamp) VALUES (:game, :message, NOW(6))';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':message', json_encode($message), PDO::PARAM_STR);
        $stmt->execute();
    } catch (PDOException $e) {
        error_log($e->getMessage());
        exit();
    }
}
