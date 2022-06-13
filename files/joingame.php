<?php
$gameStatus = getGameStatus($game);
$players = getPlayers($game);
?>
<html lang="en">

    <head>
        <meta charset="UTF-8">
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
        <script type="text/javascript" src="<?php echo WEB_ROOT;?>scrabble.js"></script>
        <link type="text/css" rel="stylesheet" href="<?php echo WEB_ROOT;?>scrabble.css">
        <script>
            var game = "<?php echo $_GET['game'];?>";

        </script>
        <title>Scrabble</title>
    </head>

    <body>
        <div class="flex-wrapper">
            <div id="header">
                <div class="header-content-wrapper">
                    <div class="header-content">
                        <span id="header-general">
                            <input type="submit" value="Full screen (F11)" id="full-screen">
                        </span>
                        <span id="header-join">
                            <input type="submit" id="nothanks" value="New game">
                        </span>
                        <span id="header-lobby">
                            <input type="submit" value="Change player" class="change-player">
                            <input type="submit" value="Remove player" class="delete-player">
                        </span>
                        <span id="header-game">
                            <input type="submit" value="Change player" class="change-player">
                            <input type="submit" value="Leave game (skip my turn until I rejoin)" id="skip-player">
                            <input type="submit" value="Rejoin game" id="unskip-player">
                        </span>
                    </div>
                </div>
            </div>
            <div id="content">
                <div id="message-overlay"></div>
                <div id="message">Change tiles? Type "scrabble" + Return to confirm, or hit Return to cancel:<br><input type="text" maxlength="8" id="confirm-change-tiles">
                </div>
                <div class="content-wrapper">
                    <div class="content-background">
                    </div>
                    <div id="content-join">
                        <p>
                            <b>
                                <?php
                                if ($gameStatus == 'lobby') {
                                    echo 'Game has not started yet.';
                                } else if ($gameStatus == 'ended') {
                                    echo 'Game has ended.';
                                } else {
                                    echo 'Game is in progress.';
                                }
                                ?>
            
                            </b>
                        </p>
                        <p>Play as:</p>
                        <div class="join-player-cards"><?php
                            foreach ($players as $player):
                            ?>
            
                            <div class="select-player">
                                <div class="player-card-content-wrapper">
                                    <div class="player-card-content">
                                        <?php
                                        echo $player->name;
                                        ?>
            
                                        <input id="player_id" type="hidden" value="<?php echo $player->player_id;?>">
                                    </div>
                                </div>
                            </div><?php
                            endforeach;
                            if (count($players) < $maxPlayers && $gameStatus == 'lobby') {
                            ?>
            
                            <div class="new-player">
                                <input type="text" placeholder="New player" maxlength="20" size="20" id="new-player-name">
                                <br>
                                <input type="submit" value="Go" id="new-player-button">
                            </div><?php
                            }
                            ?>
            
                        </div>
                    </div>
                    <div id="content-lobby">
                        <div id="lobby-cards">
                        </div>
                        <div class="lobby-buttons">
                            <input type="submit" id="button-wait" value="Wait for players">
                            <input type="submit" id="button-ready" value="Start game!">
                        </div>
                    </div>
                    <div id="content-game">
                        <div class="content-game-wrapper">
                                <div class="game-pane1">
                                    <div id="game-board">
                                        <div class="game-board-content">
                                            <div class="players" id="players-left">
                                            </div>
                                            <div class="players" id="players-top">
                                            </div>
                                            <div class="players" id="players-right"></div>
                                            <div class="board-content">
                                                <div class="board-background">
                                                </div>
                                                <table class="board-grid"><?php
                                                    for ($i = 0; $i < 15; $i++) {
                                                    ?>
                                                    
                                                    <tr><?php
                                                        for ($j = 0; $j < 15; $j++) {
                                                            $coords = [$i, $j];
                                                        ?>
                                                        
                                                        <td class="<?php
                                                        if (isSquareLetter2x($coords)) {
                                                            echo 'letter2x';
                                                        } else if (isSquareLetter3x($coords)) {
                                                            echo 'letter3x';
                                                        } else if (isSquareWord2x($coords)) {
                                                            echo 'word2x';
                                                        } else if (isSquareWord3x($coords)) {
                                                            echo 'word3x';
                                                        } else {
                                                            echo 'square-empty';
                                                        }
                                                        ?>"><?php
                                                            if (isSquareLetter2x($coords)) {
                                                                boardExtras(2, 'letter2x');
                                                            } else if (isSquareLetter3x($coords)) {
                                                                boardExtras(3, 'letter3x');
                                                            } else if (isSquareWord2x($coords)) {
                                                                if ($i != 7 || $j != 7) {
                                                                    boardExtras(2, 'word2x');
                                                                }
                                                            } else if (isSquareWord3x($coords)) {
                                                                boardExtras(3, 'word3x');
                                                            }
                                                            if (isSquareLetter2x($coords)) {
                                                                echo 'DOUBLE<br> LETTER';
                                                            } else if (isSquareLetter3x($coords)) {
                                                                echo 'TRIPLE<br> LETTER';
                                                            } else if (isSquareWord2x($coords)) {
                                                                if ($i == 7 && $j == 7) {
                                                                    echo '<svg viewBox="-100 -100 200 200"><polygon points="95,0 -67,67 0,-95 67,67 -95,0 67,-67 0,95 -67,-67"  style="fill:black" /></svg>';
                                                                } else {
                                                                    echo 'DOUBLE<br> WORD';
                                                                }
                                                            } else if (isSquareWord3x($coords)) {
                                                                echo 'TRIPLE<br> WORD';
                                                            }
                                                            ?>
                                                                        
                                                        </td><?php
                                                        }
                                                        ?>
                                                        
                                                    </tr><?php
                                                    }
                                                    ?>
                                                    
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="current-player-tile-area">
                                    </div>
                                    <div id="current-player-name-wrapper">
                                        <div id="current-player-name">
                                        </div>
                                    </div>
                                </div>
                                <div class="game-pane2">
                                    <div id="calculations">
                                    </div>
                                    <div id="bag"><div id="bag-wrapper"><img src="<?php echo WEB_ROOT;?>bag-green.png"><img src="<?php echo WEB_ROOT;?>bag-green.png" class="cover" draggable="false"></div></div>
                                    <div id="move-buttons">
                                        <div id="move-button-container">
                                            <input type="button" id="reject" value="✘" class="move-button" title="Cancel move / Reject previous move"><!--
                                            --><input type="button" id="approve" value="✓" class="move-button" title="Ready / Confirm previous move"><!--
                                            --><input type="button" id="change-tiles" value="🗘" class="move-button" title="Change tiles">
                                        </div>
                                    </div>
                                </div>
                                <div class="game-pane3">
                                    <div id="scoreboard">
                                    </div>
                                    <div id="chat">
                                        <div id="chat-wrapper">
                                            <div id="chat-messages"></div>
                                            <div id="chat-input-wrapper">
                                                <input type="text" id="chat-input" placeholder="Write something..." maxlength="100">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
</html>
