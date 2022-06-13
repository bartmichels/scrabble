var FPS = 20;
var my_player_id;
var is_active_player = false;
var is_move_submitted = false;
var content;
$(document).ready(function() {
    content = document.getElementById("content");
    document.getElementById("full-screen").addEventListener("click", event => {
        content.requestFullscreen();
    });
    document.addEventListener("keydown", function(event) {
        if (event.keyCode == 122) {
            event.preventDefault();
            content.requestFullscreen();
        }
    });
});

/************************************************
 * Message handling.
/************************************************/

var lastMessageTime;
var ignoreMessages = [];

function handleGameMessage(message) {
    var ignoreIndex = ignoreMessages.indexOf(message.ignoreId);
    if (ignoreIndex >= 0) {
        ignoreMessages.splice(ignoreIndex, 1);
        return;
    }
    switch (message.type) {
        case "new player":
            lobbyAddPlayerCard(message, false);
            break;
        case "delete player":
            lobbyDeletePlayerCard(message.player_id);
            break;
        case "player wait":
            lobbyPlayerWait(message.player_id);
            break;
        case "player ready":
            lobbyPlayerReady(message.player_id);
            break;
        case "setup game":
            setTimeout(() => {
                loadGame(message.gameData);
            }, 1000);
            break;
        case "rank letter":
            addRankLetter(message.player_id, message.letter, message.round);
            if (my_player_id == message.player_id) {
                disableBagClick();
            }
            setBagTileNumber(message.bagTotal);
            break;
        case "rank round winners":
            window.setTimeout(function() {
                setRankLetterWinners(message.winners, message.round);
                if (message.winners.length > 1 &&
                    message.winners.indexOf(my_player_id) >= 0) {
                    enableBagClick();
                }
            }, 500);
            break;
        case "start game":
            window.setTimeout(() => {
                setActivePlayer(message.activePlayer);
                addGameChatMessage(message.playerName + " begins.");
                if (message.playerCount > 2) {
                    skipButton.style.display = "inline-block";
                }
            }, 1000);
            break;
        case "player skip":
            addGameChatMessage(message.playerName + " has left the game.");
            setScoreBoard(message.startingPlayer, message.players, message.scoreboard);
            if (message.player_id == my_player_id) {
                skipButton.style.display = "none";
                unskipButton.style.display = "inline-block";
                unHighlightApproveReject();
                is_active_player = false;
                is_move_submitted = false;
                disableApprove();
                disableReject();
                disableChangeTiles();
                putTilesBack();
            } else {
                if (message.players.filter(player => !player.skip).length <= 2) {
                    skipButton.style.display = "none";
                }
                setOtherPlayerTileNumber(message.player_id, message.totalLetters);
                message.oldUsedLetters.forEach(tileData => {
                    removeOldTile(tileData.square);
                });
                unHighlightApproveReject();
                // Don't change buttons of active player (which we assume here is not the skipped player)
                // Except for the change tiles button, which should be enabled in case active player was not previously active player.
                if (message.activePlayer == my_player_id) {
                    is_active_player = true;
                    if (!message.isMoveSubmitted) {
                        enableChangeTiles();
                    }
                } else if (message.verifyingPlayer == my_player_id && message.isMoveSubmitted) {
                    // Enable buttons for verifying player
                    highlightApproveReject();
                    enableReject();
                    enableApprove();
                } else {
                    // Disable buttons for everyone else
                    disableApprove();
                    disableReject();
                }
            }

            break;
        case "player unskip":
            addGameChatMessage(message.playerName + " has rejoined the game.");
            if (message.player_id == my_player_id) {
                skipButton.style.display = "inline-block";
                unskipButton.style.display = "none";
            } else if (!message.players.filter(player => player.player_id == my_player_id)[0].skip) {
                skipButton.style.display = "inline-block";
            }
            // Don't modify buttons for active player. Modify buttons for verifying player, and disable for everyone else.
            if (message.activePlayer != my_player_id) {
                if (message.verifyingPlayer == my_player_id && message.isMoveSubmitted) {
                    highlightApproveReject();
                    enableReject();
                    enableApprove();
                } else {
                    disableApprove();
                    disableReject();
                    unHighlightApproveReject();
                }
            }

            break;
        case "place tile":
            if (message.player_id == my_player_id) {
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                setSquareVacancies(message.squaresFree);
            } else {
                setOtherPlayerTileNumber(message.player_id, message.idleTiles.length);
                addOldTile(message.tileData);
            }
            break;
        case "place old letter":
            removeOldTile(message.tileData.square);
            addOldTile(message.tileData);
            break;
        case "letters after move":
            setBagTileNumber(message.bagTotal);
            if (message.player_id == my_player_id) {
                positionCurrentPlayerTiles(message.letters, []);
            } else {
                setOtherPlayerTileNumber(message.player_id, message.letters.length);
            }
            break;
        case "put tile back":
            if (message.player_id == my_player_id) {
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                setSquareVacancies(message.squaresFree);
            } else {
                setOtherPlayerTileNumber(message.player_id, message.idleTiles.length);
                removeOldTile(message.square);
            }
            break;
        case "put tiles back":
            if (message.player_id == my_player_id) {
                disableReject();
                disableApprove();
                putTilesBack();
            } else {
                setOtherPlayerTileNumber(message.player_id, message.totalLetters);
                message.oldTiles.forEach(tileData => removeOldTile(tileData.square));
            }
            setSquareVacancies(message.squaresFree);
            break;
        case "submit move":
            if (message.activePlayer == my_player_id) {
                is_move_submitted = true;
                disableChangeTiles();
                // Make sure tiles are where they should be
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                disableApprove();
                // Remove used tiles and replace by old tiles
                message.usedTiles.forEach(tileData => {
                    removeCurrentPlayerTile(tileData.square);
                    addOldTile(tileData);
                });
            } else if (message.verifyingPlayer == my_player_id) {
                enableReject();
                enableApprove();
                highlightApproveReject();
            }
            break;
        case "invalid move":
            if (message.activePlayer == my_player_id) {
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                setSquareVacancies(message.squaresFree);
                addGameChatMessage("Invalid move.");
            }
            break;
        case "cancel move":
            if (message.activePlayer == my_player_id) {
                is_move_submitted = false;
                message.usedTiles.forEach(tileData => {
                    removeOldTile(tileData.square);
                    addCurrentPlayerTile(tileData.letter).setToSquare(tileData.square);
                });
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                setSquareVacancies(message.squaresFree);
                enableApprove();
                enableChangeTiles();
            } else {
                if (message.verifyingPlayer == my_player_id) {
                    disableReject();
                    disableApprove();
                    unHighlightApproveReject();
                }
            }
            break;
        case "reject move":
            if (message.activePlayer == my_player_id) {
                is_move_submitted = false;
                message.usedTiles.forEach(tileData => {
                    removeOldTile(tileData.square);
                    addCurrentPlayerTile(tileData.letter).setToSquare(tileData.square);
                });
                positionCurrentPlayerTiles(message.idleTiles, message.usedTiles);
                setSquareVacancies(message.squaresFree);
                enableApprove();
                enableChangeTiles();
                addGameChatMessage(message.verifyingPlayerName + " has refused your move.");
            } else if (message.verifyingPlayer == my_player_id) {
                disableReject();
                disableApprove();
                unHighlightApproveReject();
            }
            break;
        case "verify move":
            if (message.activePlayer == my_player_id) {
                is_active_player = false;
                is_move_submitted = false;
                disableReject();
            } else if (message.verifyingPlayer == my_player_id) {
                if (!message.ended) {
                    is_active_player = true;
                    enableChangeTiles();
                }
                is_move_submitted = false;
                disableReject();
                disableApprove();
                unHighlightApproveReject();
            }
            break;
        case "change tiles":
            if (message.activePlayer == my_player_id) {
                is_active_player = false;
                is_move_submitted = false;
                disableApprove();
                disableReject();
                disableChangeTiles();
                removeCurrentPlayerTiles();
                positionCurrentPlayerTiles(message.letters, []);
            } else {
                setOtherPlayerTileNumber(message.activePlayer, message.letters.length);
                message.oldUsedLetters.forEach(tileData => {
                    removeOldTile(tileData.square);
                });
                if (message.verifyingPlayer == my_player_id) {
                    is_active_player = true;
                    enableChangeTiles();
                    is_move_submitted = false;
                    disableReject();
                    disableApprove();
                    unHighlightApproveReject();
                }
            }
            calculations.innerHTML = "";
            setBagTileNumber(message.bagTotal);
            addGameChatMessage(message.activePlayerName + " has changed their tiles.");
            setSquareVacancies(message.squaresFree);
            setScoreBoard(message.startingPlayer, message.players, message.scoreboard);
            break;
        case "move result":
            showMoveResult(message.activePlayerName, message.result);
            setScoreBoard(message.startingPlayer, message.players, message.scoreboard);
            break;
        case "end game":
            setTimeout(() => {
                let winners = getWinners(message.players, message.scoreTotals);
                setScoreBoard(message.startingPlayer, message.players, message.scoreboard, message.minusPoints, message.scoreTotals, winners);
                let winnerMessage = "";
                if (winners.length == 1) {
                    winnerMessage = winners[0].name + " wins the game!";
                } else {
                    winnerMessage = winners.map(player => player.name).join(" and ") + " win the game!";
                }
                addGameChatMessage(winnerMessage);
                message.players.forEach(player => {
                    showOtherPlayerLetters(player.player_id, message.playerLetters[player.player_id]);
                });
            }, 5000);
            break;
        case "chat":
            addPlayerChatMessage(message.name, message.message);
            break;
    }
}

function sendGameData(data) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", location.href);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onload = function() {
            if (this.status >= 200 && this.status < 300) {
                try {
                    let data = JSON.parse(xhr.response);
                    resolve(data);
                } catch (error) {
                    window.console.error(xhr.response);
                }
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function() {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send(data);
    });
}

function sendGameMessage(message, ignoreResponse) {
    if (ignoreResponse) {
        var ignoreId = getRandomId();
        ignoreMessages.push(ignoreId);
        message.ignoreId = ignoreId;
    }
    message.game = game;
    message.player_id = my_player_id || "";
    var data = "action=send_message&message=" + encodeURIComponent(JSON.stringify(message));
    return sendGameData(data);
}

function requestGameMessage() {
    var data = "action=request_message";
    data += "&game=" + game;
    data += "&since=" + lastMessageTime;
    return sendGameData(data);
}

function triggerMessageRequest() {
    // Send message request, and repeat after request is handled and timer has expired.
    var requestHandled = requestGameMessage().then(result => {
        if (result.messages.length > 0) {
            lastMessageTime = result.messages[result.messages.length - 1].timestamp;
        }
        result.messages.forEach(handleGameMessage);
    }, () => {});
    var timer = new Promise((resolve, reject) => {
        window.setTimeout(function() {
            resolve();
        }, 1000 / FPS)
    });
    Promise.all([timer, requestHandled]).then(triggerMessageRequest);
}

/************************************************
 * Code for game joining.
/************************************************/

var joinContent;
var joinHeader;
var nameInput;
var newPlayerDiv;
var newPlayerButton;
var joinAllowed = true;

$(document).ready(function() {
    joinContent = document.getElementById("content-join");
    joinHeader = document.getElementById("header-join");
    newPlayerDiv = document.querySelector(".new-player");
    nameInput = document.getElementById("new-player-name");
    newPlayerButton = document.getElementById("new-player-button");
    nameInput && nameInput.addEventListener("keydown", function(event) {
        if (event.keyCode === 13) {
            newPlayerButton.click();
        }
    });
    newPlayerButton && newPlayerButton.addEventListener("click", function() {
        newPlayer(nameInput.value);
    });
    document.getElementById("nothanks").addEventListener("click", () => {
        location.href = "..";
    });
    document.querySelectorAll(".select-player").forEach(item => {
        item.addEventListener("click", event => {
            if (!joinAllowed) {
                return;
            }
            disableJoin();
            var idInput = item.querySelector("input[type=hidden]")
            my_player_id = parseInt(idInput.value);
            item.classList.add("player-selected")
            tryJoin();
        });
    });
});

function hideJoin() {
    joinContent.style.display = "none";
    joinHeader.style.display = "none";
}

function disableJoin() {
    joinAllowed = false;
    document.querySelectorAll(".select-player").forEach(item => {
        item.style.cursor = "context-menu";
    });
    newPlayerButton && (newPlayerButton.disabled = true);
}

function newPlayer(name) {
    if (!joinAllowed || name.length == 0) return;
    disableJoin();
    newPlayerDiv.classList.add("player-selected")
    sendGameMessage({
        type: "new player",
        name: name
    }).then(function(message) {
        if (message.status == "ok") {
            my_player_id = parseInt(message.player_id);
            tryJoin();
        } else {
            location.reload();
        }
    }, window.console.error).catch(window.console.error);
}

function tryJoin() {
    sendGameMessage({
        type: "join"
    }).then(function(message) {
        if (message.status == "ok") {
            sendGameMessage({
                type: "get data"
            }).then(function(data) {
                lastMessageTime = data.timestamp;
                if (data.status == "lobby") {
                    loadLobby(data);
                } else {
                    loadGame(data);
                }
                triggerMessageRequest();
            });
        } else {
            location.reload();
        }
    });
}

/************************************************
 * Code for lobby.
/************************************************/

var lobbyContent;
var lobbyHeader;
var lobbyCards;
var waitText = "Waiting...";
var startText = "Start!";

$(document).ready(function() {
    lobbyHeader = document.getElementById("header-lobby");
    lobbyContent = document.getElementById("content-lobby");
    lobbyCards = document.getElementById("lobby-cards");
    document.querySelectorAll(".change-player").forEach(item => {
        item.addEventListener("click", event => {
            location.reload();
        });
    });
    document.querySelector(".delete-player").addEventListener("click", function() {
        sendGameMessage({
            type: "delete player"
        }).then(result => location.reload());
    });
    document.getElementById("button-wait").addEventListener("click", function() {
        sendGameMessage({
            type: "player wait"
        });
    });
    document.getElementById("button-ready").addEventListener("click", function() {
        sendGameMessage({
            type: "player ready"
        });
    });
});

function showLobby() {
    lobbyHeader.style.display = "inline";
    lobbyContent.style.display = "block";
}

function hideLobby() {
    lobbyHeader.style.display = "none";
    lobbyContent.style.display = "none";
}

function loadLobby(data) {
    data.players.forEach(player => {
        lobbyAddPlayerCard(player, player.player_id == my_player_id);
    });
    hideJoin();
    showLobby();
}

function lobbyPlayerExists(player_id) {
    return !!document.getElementById("lobby-player-card-" + player_id);
}

function lobbyAddPlayerCard(playerData, current) {
    if (lobbyPlayerExists(playerData.player_id)) {
        return;
    }
    var cardDiv = document.createElement("div");
    var contentWrapper = document.createElement("div");
    var contentDiv = document.createElement("div");
    var nameNode = document.createElement("span");
    var statusDiv = document.createElement("div");

    cardDiv.append(contentWrapper);
    contentWrapper.append(contentDiv);
    contentDiv.append(nameNode)
    contentDiv.append(statusDiv);
    nameNode.innerHTML = playerData.name;

    cardDiv.id = "lobby-player-card-" + playerData.player_id;
    cardDiv.classList.add("player-card");
    contentWrapper.classList.add("player-card-content-wrapper");
    contentDiv.classList.add("player-card-content");
    statusDiv.classList.add("player-ready-status");
    if (playerData.ready == 1) {
        cardDiv.classList.add("player-ready");
        statusDiv.append(startText);
    } else {
        cardDiv.classList.add("player-wait");
        statusDiv.append(waitText);
    }
    if (current) {
        cardDiv.classList.add("current-player");
    }
    lobbyCards.append(cardDiv);
}

function lobbyDeletePlayerCard(id) {
    if (id == my_player_id) {
        location.reload();
    }
    var playerCard = document.getElementById("lobby-player-card-" + id);
    if (playerCard) {
        lobbyCards.removeChild(playerCard);
    }
}

function lobbyPlayerWait(player_id) {
    var playerCard = document.getElementById("lobby-player-card-" + player_id);
    if (playerCard) {
        playerCard.classList.add("player-wait");
        playerCard.classList.remove("player-ready");
        playerCard.querySelector(".player-ready-status").innerHTML = waitText;
    }
}

function lobbyPlayerReady(player_id) {
    var playerCard = document.getElementById("lobby-player-card-" + player_id);
    if (playerCard) {
        playerCard.classList.remove("player-wait");
        playerCard.classList.add("player-ready");
        playerCard.querySelector(".player-ready-status").innerHTML = startText;
    }
}

/************************************************
 * Code for game.
/************************************************/

var gameHeader;
var gameContent;
var skipButton;
var unskipButton;
var skip_me;
var rejectButton;
var approveButton;
var changeTilesButton;
var calculations;
var bag;
var bagClickAllowed;
var scoreboardDiv;
var chatDiv;
var chatMessages;
var chatInput;
var confirmChangeTiles;
var changeTilesConfirming;

$(document).ready(function() {
    gameHeader = document.getElementById("header-game");
    gameContent = document.getElementById("content-game");
    skipButton = document.getElementById("skip-player");
    unskipButton = document.getElementById("unskip-player");
    currentPlayerTileArea = document.getElementById("current-player-tile-area");
    calculations = document.getElementById("calculations");
    bag = document.getElementById("bag-wrapper");
    bag.onclick = function() {
        if (bagClickAllowed) {
            sendGameMessage({
                type: "draw rank letter"
            });
        }
    };
    rejectButton = document.getElementById("reject");
    rejectButton.addEventListener("click", function() {
        sendGameMessage({
            type: "reject"
        });
    });
    approveButton = document.getElementById("approve");
    approveButton.addEventListener("click", function() {
        sendGameMessage({
            type: "approve"
        });
    });
    changeTilesButton = document.getElementById("change-tiles");
    confirmChangeTiles = document.getElementById("confirm-change-tiles");
    confirmChangeTiles.addEventListener("keydown", event => {
        if (event.keyCode == 13) {
            if (confirmChangeTiles.value.toLowerCase() == "scrabble") {
                sendGameMessage({
                    type: "change tiles"
                });
            }
        }
        if (event.keyCode == 13 || event.keyCode == 27) {
            confirmChangeTiles.value = "";
            document.getElementById("message-overlay").style.display = "none";
            document.getElementById("message").style.display = "none";
            changeTilesConfirming = false;
            chatInput.focus();
        }
    });
    changeTilesButton.addEventListener("click", function() {
        changeTilesConfirming = true;
        document.getElementById("message-overlay").style.display = "block";
        document.getElementById("message").style.display = "block";
        confirmChangeTiles.focus();
    });
    scoreboardDiv = document.getElementById("scoreboard");
    skipButton.addEventListener("click", function() {
        sendGameMessage({
            type: "player skip"
        });
    });
    unskipButton.addEventListener("click", function() {
        sendGameMessage({
            type: "player unskip"
        });
    });
    chatDiv = document.getElementById("chat");
    chatMessages = document.getElementById("chat-messages");
    chatInput = document.getElementById("chat-input");
    chatInput.addEventListener("keydown", event => {
        if (event.keyCode == 13 && chatInput.value.trim().length > 0) {
            sendGameMessage({
                type: "chat",
                message: chatInput.value
            });
            chatInput.value = "";
        }
    });
});

function showGame() {
    gameHeader.style.display = "inline";
    gameContent.style.display = "block";
}

function hideGame() {
    gameHeader.style.display = "none";
    gameContent.style.display = "none";
}

function loadGame(data) {
    window.addEventListener("resize", resizeGameContent);
    "mouseup mousedown click focus".split(" ").forEach((eventType) => {
        window.addEventListener(eventType, () => {
            if (!changeTilesConfirming) {
                chatInput.focus();
            } else {
                confirmChangeTiles.focus();
            }
        });
    });
    var currentPlayerIndex;
    data.players.forEach((player, i) => {
        if (player.player_id == my_player_id) {
            currentPlayerIndex = i;
            document.getElementById("current-player-name").innerHTML = player.name;
        }
    });
    if (currentPlayerIndex === undefined) {
        window.location.reload();
    }
    if (data.status == 'started') {
        var skipMe = data.players[currentPlayerIndex].skip;
        if (skipMe) {
            unskipButton.style.display = "inline-block";
        } else if (data.players.filter(player => !player.skip).length > 2 && !data.players.filter(player => player.player_id == my_player_id)[0].skip) {
            skipButton.style.display = "inline-block";

        }
    }

    // Create player divs around board
    var otherPlayers = data.players.length - 1;
    var countPlayerRest = otherPlayers - 3 * Math.floor(otherPlayers / 3);
    var countPlayersVertical = Math.floor(otherPlayers / 3) + Math.floor(countPlayerRest / 2);
    var countPlayersHorizontal = Math.floor(otherPlayers / 3) + countPlayerRest % 2;
    var j = 0;
    for (var i = 0; i < data.players.length - 1; i++) {
        let div = document.createElement("div");
        div.classList.add("player");
        var nameDiv = document.createElement("div");
        nameDiv.classList.add("other-player-name");
        var tileAreaDiv = document.createElement("div");
        tileAreaDiv.classList.add("other-player-tilearea");
        var relativePlayerIndex;
        dimensions.maxPlayersOnSide = Math.max(countPlayersVertical, countPlayersHorizontal);
        if (j < countPlayersVertical) {
            relativePlayerIndex = countPlayersVertical - 1 - j;
            div.style.width = (100 / countPlayersVertical) + "%";
            div.appendChild(tileAreaDiv);
            div.appendChild(nameDiv);
            document.getElementById("players-left").append(div);
        } else if (j < countPlayersVertical + countPlayersHorizontal) {
            relativePlayerIndex = j;
            div.style.width = (100 / countPlayersHorizontal) + "%";
            div.appendChild(nameDiv);
            div.appendChild(tileAreaDiv);
            document.getElementById("players-top").append(div);
        } else {
            relativePlayerIndex = countPlayersVertical + countPlayersHorizontal + data.players.length - 2 - j;
            div.style.width = (100 / countPlayersVertical) + "%";
            div.appendChild(tileAreaDiv);
            div.appendChild(nameDiv);
            document.getElementById("players-right").append(div);
        }
        var playerIndex = (currentPlayerIndex + 1 + relativePlayerIndex) % data.players.length;
        div.id = "pos-player-" + data.players[playerIndex].player_id;
        tileAreaDiv.id = "tile-area-player-" + data.players[playerIndex].player_id;
        nameDiv.innerHTML = data.players[playerIndex].name;
        for (var k = 0; k < 7; k++) {
            let tile = document.createElement("div");
            tile.classList.add("scrabble-tile");
            tile.classList.add("other-player-tile");
            tile.id = "player-" + data.players[playerIndex].player_id + "-tile-" + (k + 1);
            tileAreaDiv.append(tile);
        }
        j++;
    }

    // Set other players idle tile count
    data.players.forEach(player => {
        if (player.player_id != my_player_id) {
            setOtherPlayerTileNumber(player.player_id, data.idlePlayerLetters[player.player_id].length);
        }
    });

    // Set verifying buttons
    disableApprove();
    disableReject();
    disableChangeTiles();
    if (data.isMoveSubmitted && data.verifyingPlayer == my_player_id) {
        enableReject();
        enableApprove();
        highlightApproveReject();
    }

    if (data.activePlayer == my_player_id) {
        is_move_submitted = data.isMoveSubmitted;
        if (is_move_submitted) {
            disableChangeTiles();
            disableApprove();
            enableReject();
        }
    }

    // Show game content. This includes resizing everything.
    hideJoin();
    hideLobby();
    showGame();

    // If game has ended, show other player tiles
    if (data.status == "ended") {
        data.players.forEach(player => {
            showOtherPlayerLetters(player.player_id, data.playerLetters[player.player_id]);
        });
    }

    resizeGameContent();
    // ALl tiles should be added after first resize, so that dimensions are set.
    if (data.status == "setup") {
        initializeRankLetterInfo(data.players);
    }

    setSquareVacancies(data.squaresFree);

    // All tiles with letters should be added after first paint.
    setTimeout(() => {
        // Place old tiles on board. This needs to come after showing game.
        data.oldTiles.forEach(tileData => {
            addOldTile(tileData);
        });

        // Add my idle tiles
        data.idlePlayerLetters[my_player_id].forEach(letter => {
            addCurrentPlayerTile(letter);
        });
        if (data.activePlayer != -1) {
            setActivePlayer(data.activePlayer);

            // Move is submitted or I am not active player: add used tiles.
            if (data.activePlayer != my_player_id || data.isMoveSubmitted && data.activePlayer == my_player_id) {
                data.usedPlayerLetters[data.activePlayer].forEach(tileData => {
                    addOldTile(tileData);
                });
            } else {
                // I am active player and move is not submitted
                // Add used tiles and position them.
                positionCurrentPlayerTiles(data.idlePlayerLetters[my_player_id], data.usedPlayerLetters[my_player_id]);
            }
        }

        if (data.status == "setup") {
            // Add rank letters
            data.players.forEach(player => {
                data.playerRankLetters[player.player_id].forEach((letter, round) => {
                    addRankLetter(player.player_id, letter, round);
                });
            });
            // Previous round winners
            for (i = 0; i < data.rankLetterWinners.length; i++) {
                setRankLetterWinners(data.rankLetterWinners[i], i);
            }
            // Enable or disable bag clicking
            if (data.rankLetterPlayers.indexOf(my_player_id) >= 0 &&
                !(data.rankLetterRound in data.playerRankLetters[my_player_id])) {
                enableBagClick();
            } else {
                disableBagClick();
            }
        }
    }, 0);

    // Bag size needs to be set before adding new bag letters
    var bagDiv = document.getElementById("bag-wrapper");
    for (i = 1; i <= data.totalLetters; i++) {
        let bagTile = document.createElement("div");
        bagTile.classList.add("scrabble-tile");
        bagTile.classList.add("bag-tile");
        bagTile.id = "bagtile-" + i;
        let radius = Math.random() * (1 - dimensions.bagCenterFactors.top) * 0.70;
        let angle = Math.random() * 2 * Math.PI;
        let left = (radius * Math.cos(angle) + dimensions.bagCenterFactors.left) * 100;
        let top = (radius * Math.sin(angle) + dimensions.bagCenterFactors.top) * 100;
        bagTile.style.top = top + "%";
        bagTile.style.left = left + "%";
        bagTile.style.width = dimensions.otherPlayerTileSize;
        bagTile.style.height = dimensions.otherPlayerTileSize;
        bagDiv.append(bagTile);
    }
    setBagTileNumber(data.bag.length);

    // Set scoreboard
    if (data.startingPlayer != -1) {
        if (data.status != "ended") {
            setScoreBoard(data.startingPlayer, data.players, data.scoreboard);
        } else {
            let winners = getWinners(data.players, data.scoreTotals);
            setScoreBoard(data.startingPlayer, data.players, data.scoreboard, data.minusPoints, data.scoreTotals, winners);
        }
    }

    chatInput.focus();
}

function disableApprove() {
    approveButton.disabled = true;
}

function enableApprove() {
    approveButton.disabled = false;
}

function disableReject() {
    rejectButton.disabled = true;
}

function enableReject() {
    rejectButton.disabled = false;
}

function highlightApproveReject() {
    approveButton.style.boxShadow = "0px 0px 10px 2px";
    rejectButton.style.boxShadow = "0px 0px 10px 2px";
}

function unHighlightApproveReject() {
    approveButton.style.boxShadow = "";
    rejectButton.style.boxShadow = "";
}

function disableChangeTiles() {
    changeTilesButton.disabled = true;
}

function enableChangeTiles() {
    changeTilesButton.disabled = false;
}

function enableBagClick() {
    bagClickAllowed = true;
    bag.classList.add("click-allowed");
}

function disableBagClick() {
    bagClickAllowed = false;
    bag.classList.remove("click-allowed");
}

function initializeRankLetterInfo(players) {
    var head = document.createElement("div");
    head.classList.add("calculation-head");
    head.innerHTML = "Who begins?";
    calculations.append(head);
    players.forEach(player => {
        var playerRankDiv = document.createElement("div");
        playerRankDiv.classList.add("player-rank-div");
        var playerRankLetters = document.createElement("div");
        playerRankLetters.id = "player-rank-letters-" + player.player_id;
        playerRankLetters.classList.add("player-rank-letters");
        playerRankDiv.style.height = dimensions.tileSize * 1.2;
        var nameWrapper = document.createElement("div");
        nameWrapper.classList.add("player-rank-name-wrapper");
        nameWrapper.style.width = (dimensions.playerRankNameWidthFactor * 100) + "%";
        var nameSpan = document.createElement("div");
        nameWrapper.appendChild(nameSpan);
        nameSpan.classList.add("player-rank-name");
        nameSpan.id = "player-rank-name-" + player.player_id;
        nameSpan.innerHTML = player.name + ":";
        playerRankDiv.append(nameWrapper);
        playerRankDiv.append(playerRankLetters);
        calculations.append(playerRankDiv);
    });
}

function addRankLetter(player_id, letter, round) {
    var rankTile = tileElement(letter);
    rankTile.classList.add("rank-tile");
    rankTile.style.width = rankTile.style.height = dimensions.tileSize;
    rankTile.style.left = round * dimensions.tileSize * 1.2;
    rankTile.id = "player-" + player_id + "-rank-tile-" + round;
    document.getElementById("player-rank-letters-" + player_id).append(rankTile);
    if (letter == " ") {
        return;
    }
    resizeScrabbleTileTextWrapper(rankTile);
}

function setRankLetterWinners(players, round) {
    players.forEach(player_id => {
        document.getElementById("player-" + player_id + "-rank-tile-" + round).classList.add("tile-winner");
    });
}

/************************************************
 * Resize content.
/************************************************/

document.addEventListener('fullscreenchange', resizeGameContent, false);
document.addEventListener('mozfullscreenchange', resizeGameContent, false);
document.addEventListener('MSFullscreenChange', resizeGameContent, false);
document.addEventListener('webkitfullscreenchange', resizeGameContent, false);

function getGameContentHeight() {
    var header = document.getElementById("header");
    var contentWrapperStyle = window.getComputedStyle(document.querySelector(".content-wrapper"), null);
    var totalHeight = window.innerHeight - header.offsetHeight - parseInt(contentWrapperStyle.getPropertyValue('padding-top')) - parseInt(contentWrapperStyle.getPropertyValue('padding-bottom'));
    if (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== undefined) {
        totalHeight += header.offsetHeight;
    }
    return totalHeight;
}

function resizeGameContent() {
    // abort current player tile moving
    currentPlayerTilePositioners.forEach(positioner => {
        if (positioner.status == "tile-moving") {
            positioner.abortMove();
        }
    });

    var totalHeight = getGameContentHeight();
    // Resize board
    var boardHeight = totalHeight * dimensions.boardSizeFactor;
    var currentPlayerNameHeight = totalHeight * dimensions.currentPlayerNameHeightFactor;
    var otherPlayerTileAreaHeight = boardHeight * dimensions.otherPlayerTileAreaHeightFactor;
    var otherPlayerNameHeight = boardHeight * dimensions.otherPlayerNameHeightFactor;
    var otherPlayerAreaHeight = otherPlayerTileAreaHeight + otherPlayerNameHeight + dimensions.otherPlayerAreaMargin;
    var gridSize = boardHeight - otherPlayerAreaHeight - dimensions.currentPlayerAreaMargin;
    var boardWidth = boardHeight + otherPlayerAreaHeight - dimensions.currentPlayerAreaMargin;
    var gameBoard = document.getElementById("game-board");
    gameBoard.style.width = boardWidth;
    gameBoard.style.height = boardHeight;
    gameBoard.style.paddingTop = otherPlayerAreaHeight;
    gameBoard.style.paddingRight = otherPlayerAreaHeight;
    gameBoard.style.paddingBottom = dimensions.currentPlayerAreaMargin;
    gameBoard.style.paddingLeft = otherPlayerAreaHeight;
    document.querySelectorAll(".board-grid tr").forEach((row, i) => {
        var firstCell = row.querySelector("td");
        dimensions.grid.top[i] = getDocumentCoordinates(firstCell).top;
        if (i == 0) {
            row.querySelectorAll("td").forEach((cell, j) => {
                dimensions.grid.left[j] = getDocumentCoordinates(cell).left;
            });
        }
    });

    // Resize tile area (current player)
    var oldTileareaWidth = dimensions.tileArea.width;
    dimensions.tileArea.height = totalHeight * dimensions.currentPlayerTileAreaHeightFactor;
    dimensions.tileArea.width = gridSize;
    currentPlayerTileArea.style.height = dimensions.tileArea.height;
    currentPlayerTileArea.style.width = dimensions.tileArea.width;
    currentPlayerTileArea.style.left = otherPlayerAreaHeight;
    document.getElementById("current-player-name-wrapper").style.height = currentPlayerNameHeight;

    // Set tile area limits
    var areaRect = getDocumentCoordinates(currentPlayerTileArea)
    dimensions.tileArea.left = areaRect.left;
    dimensions.tileArea.top = areaRect.top;
    dimensions.tileArea.leftLimit = dimensions.tileArea.left + dimensions.tileAreaHorizontalPaddingFactor * dimensions.tileArea.width;
    dimensions.tileArea.rightLimit = dimensions.tileArea.left + (1 - dimensions.tileAreaHorizontalPaddingFactor) * dimensions.tileArea.width;

    // Resize tiles (current player)
    dimensions.tileSize = document.querySelector("td.square-empty").offsetWidth; //getInnerHeightWithHalfBorder(document.querySelector("td.square-empty"));
    dimensions.gridMagnetMargin = dimensions.gridMagnetMarginFactor * dimensions.tileSize;
    currentPlayerTilePositioners.forEach(positioner => {
        positioner.tile.style.height = dimensions.tileSize;
        positioner.tile.style.width = dimensions.tileSize;
        if (positioner.fixed) {
            positioner.setToSquare(positioner.square);
        } else {
            positioner.tile.style.top = (dimensions.tileArea.height - dimensions.tileSize) / 2;
            let oldLeft = getDocumentCoordinates(positioner.tile).left - dimensions.tileArea.left;
            let newLeft = oldLeft * dimensions.tileArea.width / oldTileareaWidth;
            positioner.tile.style.left = newLeft;
        }
    });

    // Resize tile area (other players)
    var otherPlayerTileaAreaWidth = gridSize / Math.max(dimensions.maxPlayersOnSide, 2) * 0.9;
    document.querySelectorAll(".other-player-tilearea").forEach(element => {
        element.style.height = otherPlayerTileAreaHeight;
        element.style.width = otherPlayerTileaAreaWidth;
    });
    document.querySelectorAll(".other-player-name").forEach(element => {
        element.style.height = otherPlayerNameHeight;
    });
    document.getElementById("players-top").style.top = -otherPlayerAreaHeight;
    document.getElementById("players-left").style.left = -dimensions.otherPlayerAreaMargin;
    document.getElementById("players-right").style.left = dimensions.otherPlayerAreaMargin;

    // Resize tiles (other players)
    dimensions.otherPlayerTileSize = Math.min(otherPlayerTileaAreaWidth * 0.1, otherPlayerTileAreaHeight * 0.7);
    dimensions.otherPlayerTileOffset = 10;
    dimensions.otherPlayerTileMargin = (otherPlayerTileaAreaWidth - 7 * dimensions.otherPlayerTileSize - 2 * dimensions.otherPlayerTileOffset) / 8;
    document.querySelectorAll(".other-player-tilearea").forEach(element => {
        element.querySelectorAll(".other-player-tile-visible").forEach((element, i) => {
            element.style.left = dimensions.otherPlayerTileOffset + dimensions.otherPlayerTileMargin * (i + 1) + dimensions.otherPlayerTileSize * i;
            element.style.width = dimensions.otherPlayerTileSize;
            element.style.height = dimensions.otherPlayerTileSize;
        });
        element.querySelectorAll(".other-player-tile").forEach((element, i) => {
            element.style.left = dimensions.otherPlayerTileOffset + dimensions.otherPlayerTileMargin * (i + 1) + dimensions.otherPlayerTileSize * i;
            element.style.width = dimensions.otherPlayerTileSize;
            element.style.height = dimensions.otherPlayerTileSize;
        });
    });

    // Resize old tiles
    oldTilePositioners.forEach(positioner => {
        positioner.tile.style.height = dimensions.tileSize;
        positioner.tile.style.width = dimensions.tileSize;
        positioner.abortMove();
    });

    // Resize move buttons pane
    var moveButtonDivHeightFactor = dimensions.currentPlayerTileAreaHeightFactor + dimensions.currentPlayerNameHeightFactor;
    var moveButtonDiv = document.getElementById("move-buttons");
    moveButtonDiv.style.height = totalHeight * moveButtonDivHeightFactor - currentPlayerNameHeight;
    moveButtonDiv.style.marginBottom = currentPlayerNameHeight;

    // Resize calculation pane
    calculations.style.paddingTop = otherPlayerAreaHeight;
    calculations.style.height = totalHeight * (1 - moveButtonDivHeightFactor) * 0.6;

    // Resize rank tiles
    document.querySelectorAll(".player-rank-div").forEach(element => {
        element.style.height = dimensions.tileSize * 1.2;
        element.querySelectorAll(".rank-tile").forEach((element, round) => {
            element.style.width = element.style.height = dimensions.tileSize;
            element.style.left = round * dimensions.tileSize * 1.2;
        });
    });

    // Resize result tiles
    document.querySelectorAll(".calculation-item").forEach(element => {
        element.style.height = dimensions.otherPlayerTileSize * 1.2;
        var totalLetters = 0;
        element.querySelectorAll(".result-tile").forEach((element, i) => {
            element.style.width = element.style.height = dimensions.otherPlayerTileSize;
            element.style.left = i * dimensions.otherPlayerTileSize;
            totalLetters++;
        });
        var wordText = element.querySelector(".word-total-text-wrapper");
        if (wordText) {
            wordText.style.marginLeft = totalLetters * dimensions.otherPlayerTileSize;
        }
    });

    // Resize bag pane
    var bagDiv = document.getElementById("bag");
    bagDiv.style.height = totalHeight * (1 - moveButtonDivHeightFactor) * 0.4;
    bagDiv.style.paddingBottom = dimensions.currentPlayerAreaMargin;
    var bagDivWrapper = document.getElementById("bag-wrapper");
    var bagBox = getDocumentCoordinates(bagDiv.querySelector("img"));
    bagDivWrapper.style.width = bagBox.width;

    // Resize bag letters
    document.querySelectorAll(".bag-tile").forEach(element => {
        element.style.width = dimensions.otherPlayerTileSize;
        element.style.height = dimensions.otherPlayerTileSize;
    });

    // Resize move buttons
    var moveButtonSize = dimensions.tileArea.height * 0.7;
    document.querySelectorAll(".move-button").forEach(element => {
        element.style.height = moveButtonSize;
        element.style.width = moveButtonSize;
        element.style.fontSize = moveButtonSize * 0.5;
    });

    // Resize scoreboard pane
    scoreboardDiv.style.paddingTop = otherPlayerAreaHeight;
    scoreboardDiv.style.height = dimensions.scoreboardHeightFactor * totalHeight;

    // Resize scoreboard
    setTimeout(() => {
        dimensions.scoreboardDivBottom = getDocumentCoordinates(scoreboardDiv).bottom;
        if (scoreboardData.startingPlayer) {
            setScoreBoard(scoreboardData.startingPlayer, scoreboardData.players, scoreboardData.scoreboard, scoreboardData.minusPoints, scoreboardData.totals, scoreboardData.winners);
        }
    });

    // Resize chat
    chatDiv.style.height = (1 - dimensions.scoreboardHeightFactor) * totalHeight;
    setChatMessagesEnd();
}

/************************************************
 * Code for tiles.
/************************************************/

var currentPlayerTileArea;

var dimensions = {
    scoreboardHeightFactor: 0.7,
    scoreboardDivBottom: null,
    otherPlayerTileSize: 0,
    oldTileDragLimitFactor: 0.6,
    otherPlayerAreaMargin: 10,
    currentPlayerAreaMargin: 20,
    boardSizeFactor: 0.85,
    currentPlayerNameHeightFactor: 0.05,
    currentPlayerTileAreaHeightFactor: 0.1,
    tileArea: {
        height: null,
        width: null,
        top: null,
        left: null,
        leftLimit: null,
        rightLimit: null
    },
    tileSize: null,
    gridMagnetMargin: null,
    gridMagnetMarginFactor: 0.4,
    grid: {
        top: [],
        left: []
    },
    maxPlayersOnSide: null,
    otherPlayerTileAreaHeightFactor: 0.05,
    otherPlayerNameHeightFactor: 0.03,
    tileAreaHorizontalPaddingFactor: 0.03,
    bagCenterFactors: {
        top: 0.6,
        left: 0.4
    },
    playerRankNameWidthFactor: 0.3
};

var currentPlayerTilePositioners = [];
var oldTilePositioners = [];
var squaresFree = [];
for (let i = 0; i < 15; i++) {
    squaresFree[i] = [];
}
var letterValues = {
    'A': 1,
    'B': 3,
    'C': 5,
    'D': 2,
    'E': 1,
    'F': 4,
    'G': 2,
    'H': 4,
    'I': 1,
    'J': 8,
    'K': 5,
    'L': 1,
    'M': 3,
    'N': 1,
    'O': 1,
    'P': 3,
    'Q': 10,
    'R': 1,
    'S': 1,
    'T': 1,
    'U': 1,
    'V': 4,
    'W': 4,
    'X': 8,
    'Y': 4,
    'Z': 10,
    ' ': 0
}

// Set current player tiles where they should be. Squaresfree should be overwritten after this, to correct any local moves.
function positionCurrentPlayerTiles(idleTiles, usedTiles) {
    var currentIdleTilesPool = currentPlayerTilePositioners.filter(positioner => positioner.status == "tile-idle" || positioner.status == "tile-moving");
    var currentUsedTilesPool = currentPlayerTilePositioners.filter(positioner => positioner.status == "tile-used");

    // For every used tile in tilesData, find a matching used tile in pool. If there is none, use a used tile from pool. If there is none, use a moving tile from pool. If there is none, use an idle tile from pool. If there is none, create a tile.
    usedTiles.forEach(tileData => {
        // Look for matching used tile in pool
        var positionerIndex = currentUsedTilesPool.findIndex(positioner =>
            positioner.letter == tileData.letter &&
            positioner.square.row == tileData.square.row &&
            positioner.square.column == tileData.square.column);
        if (positionerIndex >= 0) {
            // Match found, nothing to do.
            currentUsedTilesPool.splice(positionerIndex, 1);
            return;
        }
        // Look for used tile in pool
        positionerIndex = currentUsedTilesPool.findIndex(positioner =>
            positioner.letter == tileData.letter);
        if (positionerIndex >= 0) {
            currentUsedTilesPool[positionerIndex].setToSquare(tileData.square);
            currentUsedTilesPool.splice(positionerIndex, 1);
            return;
        }
        // Look for moving tile in pool
        positionerIndex = currentIdleTilesPool.findIndex(positioner =>
            positioner.status == "tile-moving" &&
            positioner.letter == tileData.letter);
        if (positionerIndex >= 0) {
            currentIdleTilesPool[positionerIndex].abortMove();
            currentIdleTilesPool[positionerIndex].setToSquare(tileData.square);
            currentIdleTilesPool.splice(positionerIndex, 1);
            return;
        }
        // Look for idle tile in pool
        positionerIndex = currentIdleTilesPool.findIndex(positioner =>
            positioner.status == "tile-idle" &&
            positioner.letter == tileData.letter);
        if (positionerIndex >= 0) {
            currentIdleTilesPool[positionerIndex].setToSquare(tileData.square);
            currentIdleTilesPool.splice(positionerIndex, 1);
            return;
        }
        addCurrentPlayerTile(tileData.letter).setToSquare(tileData.square);
    });

    // Remaining used tiles in pool should be idle
    currentUsedTilesPool.forEach(positioner => {
        positioner.putTileBack();
    });

    // If there are used tiles, enable approve and reject. Otherwise, disable them.
    if (usedTiles.length > 0) {
        enableApprove();
        enableReject();
    } else {
        disableApprove();
        disableReject();
    }

    // For every idle tile, find moving tile in pool. If there is none, find idle tile in pool. If there is none, create an idle tile.
    idleTiles.forEach(letter => {
        // Look for moving tile in pool
        var positionerIndex = currentIdleTilesPool.findIndex(positioner =>
            positioner.letter == letter &&
            positioner.status == "tile-moving");
        if (positionerIndex >= 0) {
            currentIdleTilesPool[positionerIndex].abortMove();
            currentIdleTilesPool.splice(positionerIndex, 1);
            return;
        }
        // Look for idle tile in pool
        positionerIndex = currentIdleTilesPool.findIndex(positioner =>
            positioner.letter == letter &&
            positioner.status == "tile-idle");
        if (positionerIndex >= 0) {
            currentIdleTilesPool.splice(positionerIndex, 1);
            return;
        }
        // Create new idle tile
        addCurrentPlayerTile(letter);
    });

    // Remaning idle tiles should not be there.
    currentIdleTilesPool.forEach(positioner => {
        positioner.abortMove();
        currentPlayerTileArea.removeChild(positioner.tile);
        var index = currentPlayerTilePositioners.findIndex(p => p.id == positioner.id);
        currentPlayerTilePositioners.splice(index, 1);
    });

}

/************************************************
 * Tile creation
/************************************************/

function resizeScrabbleTileTextWrapper(tile) {
    resizeScrabbleTileText(tile);
    window.setTimeout(() => {
        resizeScrabbleTileText(tile)
    });
}

function resizeScrabbleTileText(tile) {
    var width = 2;
    var height = 2;

    var widthMaxSpan = 0.7;
    var heightMaxSpan = 0.7;
    var letterText = tile.querySelector(".scrabble-tile-text");
    var bb = letterText.getBBox();
    var widthTransform = width / bb.width * widthMaxSpan;
    var heightTransform = height / bb.height * heightMaxSpan;
    var value = widthTransform < heightTransform ? widthTransform : heightTransform;
    letterText.setAttribute("transform", "matrix(" + value + ", 0, 0, " + value + ", 0,0)");

    var factor = 0.3;
    var XShift = 0.6;
    var YShift = 0.6;
    var valueText = tile.querySelector(".scrabble-tile-number");
    bb = valueText.getBBox();
    widthTransform = width / bb.width * factor;
    heightTransform = height / bb.height * factor;
    value = widthTransform < heightTransform ? widthTransform : heightTransform;
    valueText.setAttribute("transform", "matrix(" + value + ", 0, 0, " + value + ", " + XShift + "," + YShift + ")");
}

function addCurrentPlayerTile(letter) {
    var tile = currentPlayerTileElement(letter);
    var insertionPoint = tileAreaFindFreeSpot();
    tile.style.top = (dimensions.tileArea.height - dimensions.tileSize) / 2;
    tile.style.left = insertionPoint - dimensions.tileSize / 2 - dimensions.tileArea.left;
    var positioner = new CurrentPlayerTilePositioner(tile, letter);
    positioner.setStatus("tile-idle");
    currentPlayerTilePositioners.push(positioner);
    return positioner;
}

function currentPlayerTileElement(letter) {
    var tile = tileElement(letter);
    tile.classList.add("current-player-tile");
    tile.classList.add("tile-idle");
    return tile;
}

function phantomTileElement() {
    var tile = document.createElement("div");
    tile.classList.add("tile-phantom");
    tile.style.height = dimensions.tileSize;
    tile.style.width = dimensions.tileSize;
    return tile;
}

function tileElement(letter) {
    var value = letterValues[letter];
    var tile = document.createElement("div");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var letterText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    var valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    tile.classList.add("scrabble-tile");
    tile.style.height = dimensions.tileSize;
    tile.style.width = dimensions.tileSize;
    currentPlayerTileArea.appendChild(tile);

    if (letter == " ") {
        return tile;
    }

    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "-1 -1 2 2");

    letterText.classList.add("scrabble-tile-text");
    letterText.innerHTML = letter;

    valueText.classList.add("scrabble-tile-number");
    valueText.innerHTML = value;

    tile.appendChild(svg);

    svg.appendChild(letterText);
    svg.appendChild(valueText);

    resizeScrabbleTileTextWrapper(tile);

    return tile;
}

function smallTileElement(letter, factor) {
    var value = letterValues[letter];

    var tile = document.createElement("div");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var letterText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    var valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    tile.classList.add("scrabble-tile");
    tile.style.height = dimensions.otherPlayerTileSize;
    tile.style.width = dimensions.otherPlayerTileSize;
    if (factor == 2) {
        tile.classList.add("letter2x");
    } else if (factor == 3) {
        tile.classList.add("letter3x");
    }

    if (letter == " ") {
        return tile;
    }

    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "-1 -1 2 2");

    letterText.classList.add("scrabble-tile-text");
    letterText.innerHTML = letter;

    valueText.classList.add("scrabble-tile-number");
    valueText.innerHTML = value;

    tile.appendChild(svg);

    svg.appendChild(letterText);
    svg.appendChild(valueText);

    return tile;
}

function getTilesLeftCoordsSorted() {
    var leftCoords = [];
    for (var i = 0; i < currentPlayerTilePositioners.length; i++) {
        if (currentPlayerTilePositioners[i].tile.classList.contains("tile-idle")) {
            leftCoords.push(getDocumentCoordinates(currentPlayerTilePositioners[i].tile).left);
        }
    }
    leftCoords.sort((a, b) => {
        return a - b;
    });
    return leftCoords;
}

/************************************************
 * Tile Moving
/************************************************/

// Get tiles to the left of X sorted decreasingly, together with their X-coord.
function getTilesDataLeftOfSorted(X) {
    var tilesData = [];
    for (var i = 0; i < currentPlayerTilePositioners.length; i++) {
        let tile = currentPlayerTilePositioners[i].tile;
        let left = getDocumentCoordinates(tile).left;
        if (left <= X && tile.classList.contains("tile-idle")) {
            tilesData.push({
                tile: currentPlayerTilePositioners[i].tile,
                left: left
            });
        }
    }
    tilesData.sort((a, b) => {
        return b.left - a.left;
    });
    return tilesData;
}

// Get tiles to the right of X sorted increasingly, together with their X-coord.
function getTilesDataRightOfSorted(X) {
    var tilesData = [];
    for (var i = 0; i < currentPlayerTilePositioners.length; i++) {
        let tile = currentPlayerTilePositioners[i].tile;
        let left = getDocumentCoordinates(tile).left;
        if (left >= X && tile.classList.contains("tile-idle")) {
            tilesData.push({
                tile: currentPlayerTilePositioners[i].tile,
                left: left
            });
        }
    }
    tilesData.sort((a, b) => {
        return a.left - b.left;
    });
    return tilesData;
}

// Find first free spot from the left and return the midpoint of that.
function tileAreaFindFreeSpot() {
    var leftCoords = getTilesLeftCoordsSorted();
    var currentPosition = dimensions.tileArea.leftLimit;
    for (var i = 0; i < leftCoords.length; i++) {
        if (leftCoords[i] >= currentPosition + dimensions.tileSize) {
            return (currentPosition + leftCoords[i]) / 2;
        } else {
            currentPosition = leftCoords[i] + dimensions.tileSize;
        }
    }
    // First free spot is to the right of last tile.
    return (currentPosition + dimensions.tileArea.rightLimit) / 2;
}

// Find free spot closest to X in the gap around X, false if there is none.
function tileAreaFindFreeSpotAround(X) {
    var leftCoords = getTilesLeftCoordsSorted();

    // Left end of gap around X.
    var leftEnd = dimensions.tileArea.leftLimit;
    for (var i = 0; i < leftCoords.length && leftCoords[i] < X; i++) {
        leftEnd = leftCoords[i] + dimensions.tileSize;
        if (leftEnd > X) {
            return false;
        }
    }

    // Right end of gap around X.
    var rightEnd = dimensions.tileArea.rightLimit;
    for (i = leftCoords.length - 1; i >= 0 && leftCoords[i] + dimensions.tileSize > X; i--) {
        rightEnd = leftCoords[i];
        if (rightEnd < X) {
            return false;
        }
    }

    // Not enough space.
    if (rightEnd - leftEnd + 1 < dimensions.tileSize) {
        return false;
    }

    if (X + dimensions.tileSize / 2 > rightEnd) {
        return rightEnd - dimensions.tileSize / 2;
    }

    if (X - dimensions.tileSize / 2 < leftEnd) {
        return leftEnd + dimensions.tileSize / 2;
    }

    return X;
}

function isTileAreaPositionOccupied(X) {
    for (var i = 0; i < currentPlayerTilePositioners.length; i++) {
        let tile = currentPlayerTilePositioners[i].tile;
        let left = getDocumentCoordinates(tile).left;
        if (tile.classList.contains("tile-idle") && (left <= X + dimensions.tileSize / 2 && X <= left + 3 * dimensions.tileSize / 2)) {
            return true;
        }
    }
    return false;
}

function putTilesBack() {
    currentPlayerTilePositioners.forEach(positioner => {
        positioner.abortMove();
    });
}

function setBagTileNumber(count) {
    document.querySelectorAll(".bag-tile").forEach(element => {
        if (parseInt(element.id.substring(8)) <= count) {
            element.style.visibility = "visible";
        } else {
            element.style.visibility = "hidden";
        }
    });
}

function TilePositioner(tile) {
    this.tile = tile;
    this.square = null;

    this.dragData = {
        distanceTop: null,
        distanceLeft: null
    };

    this.setLeft = function(left) {
        this.setRelLeft(left - dimensions.tileArea.left);
    };

    this.setTop = function(top) {
        this.setRelTop(top - dimensions.tileArea.top);
    };

    this.setRelTop = function(relTop) {
        this.tile.style.top = Math.min(Math.max(-dimensions.tileArea.top, relTop), (dimensions.tileArea.height - dimensions.tileSize) / 2);
    };

    this.setRelLeft = function(relLeft) {
        this.tile.style.left = Math.min(Math.max(-dimensions.tileArea.left, relLeft), window.innerWidth - dimensions.tileArea.left - dimensions.tileSize);
    };
}

TilePositioner.prototype.setToSquare = function(square) {
    this.square = square;
    setSquareVacancy(square, false);
    this.setTop(dimensions.grid.top[square.row]);
    this.setLeft(dimensions.grid.left[square.column]);
}

function OldTilePositioner(tile, square) {
    TilePositioner.apply(this, arguments);

    this.setToSquare(square);

    this.onmousedown = (function(event) {
        // Listen for move and mouseup events
        document.addEventListener("mousemove", this.ondragmove);
        document.addEventListener("mouseup", this.onmouseup);

        // Don't select text
        event = event || window.event;
        event.preventDefault();

        var tileRect = getDocumentCoordinates(this.tile);
        this.dragData.distanceLeft = window.pageXOffset + event.clientX - tileRect.left;
        this.dragData.distanceTop = window.pageYOffset + event.clientY - tileRect.top;

        this.tile.classList.add("tile-moving");
    }).bind(this);

    this.ondragmove = (function(event) {
        var left = window.pageXOffset + event.clientX - this.dragData.distanceLeft;
        left = Math.max(left, dimensions.grid.left[this.square.column] - dimensions.oldTileDragLimitFactor * dimensions.tileSize);
        left = Math.min(left, dimensions.grid.left[this.square.column] + dimensions.oldTileDragLimitFactor * dimensions.tileSize);

        var top = window.pageYOffset + event.clientY - this.dragData.distanceTop;
        top = Math.max(top, dimensions.grid.top[this.square.row] - dimensions.oldTileDragLimitFactor * dimensions.tileSize);
        top = Math.min(top, dimensions.grid.top[this.square.row] + dimensions.oldTileDragLimitFactor * dimensions.tileSize);

        this.setLeft(left);
        this.setTop(top);
    }).bind(this);

    this.onmouseup = (function(event) {
        this.abortMove();
    }).bind(this);

    this.abortMove = function() {
        document.removeEventListener("mousemove", this.ondragmove);
        document.removeEventListener("mouseup", this.onmouseup);
        this.setToSquare(this.square);
        this.tile.classList.remove("tile-moving");
    }

    this.tile.addEventListener("mousedown", this.onmousedown);
}

OldTilePositioner.prototype = Object.create(TilePositioner.prototype);

function CurrentPlayerTilePositioner(tile, letter) {
    TilePositioner.apply(this, arguments);
    this.status = null;
    this.fixed = null;
    this.letter = letter;
    this.inTileArea = null;
    this.lastLeftInArea = null;
    this.originalLeft = null;
    this.moveType = null;
    this.clickExpired = null;
    this.clickData = {
        X: null,
        Y: null,
    };
    this.id = getRandomId();

    this.setStatus = function(status) {
        this.tile.classList.remove(this.status);
        this.tile.classList.add(status);
        this.status = status;
    };

    this.setToSquare = function(square) {
        TilePositioner.prototype.setToSquare.apply(this, arguments);
        this.fixed = true;
        this.setStatus("tile-used");
    };

    this.onmousedown = (function(event) {

        this.clickData.X = window.pageXOffset + event.clientX;
        this.clickData.Y = window.pageYOffset + event.clientY;

        // Click possibility expires after 200ms
        this.clickExpired = false;
        window.setTimeout((function() {
            this.clickExpired = true;
        }).bind(this), 200);

        // Listen for move and mouseup events
        document.addEventListener("mousemove", this.ondragmove);
        document.addEventListener("mouseup", this.onfirstmouseup);
        // Don't select text
        event = event || window.event;
        event.preventDefault();

        var tileRect = getDocumentCoordinates(this.tile);
        this.dragData.distanceTop = window.pageYOffset + event.clientY - tileRect.top;
        this.dragData.distanceLeft = window.pageXOffset + event.clientX - tileRect.left;
        this.originalLeft = tileRect.left;

        this.inTileArea = this.tile.classList.contains("tile-idle");
        // Tile was idle
        if (this.inTileArea) {
            this.status = "tile-idle";
            this.lastLeftInArea = tileRect.left;
        }

        // Tile was used
        if (this.status == "tile-used") {
            setSquareVacancy(this.square, true);
            sendGameMessage({
                type: "put tile back",
                square: this.square
            }, true);
            // If no tile is being used, disable approve and reject.
            if (currentPlayerTilePositioners.filter(positioner => positioner.status == "tile-used").length == 1) {
                disableApprove();
                disableReject();
            }
        }

        this.setStatus("tile-moving");
        this.moveType = "drag";
    }).bind(this);

    this.ondragmove = (function(event) {
        if (window.pageXOffset + event.clientX != this.clickData.X || window.pageYOffset + event.clientY != this.clickData.Y) {
            this.clickExpired = true;
        }
        var left = window.pageXOffset + event.clientX - this.dragData.distanceLeft;
        var top = window.pageYOffset + event.clientY - this.dragData.distanceTop;
        left = Math.max(0, left);
        top = Math.max(0, top);
        var relLeft = left - dimensions.tileArea.left;
        var relTop = top - dimensions.tileArea.top;

        // If in grid, apply magnet
        var inGrid = (dimensions.grid.left[0] <= left + dimensions.tileSize / 2) &&
            (left + dimensions.tileSize / 2 <= dimensions.grid.left[14] + dimensions.tileSize) &&
            (dimensions.grid.top[0] <= top + dimensions.tileSize / 2) &&
            (top + dimensions.tileSize / 2 <= dimensions.grid.top[14] + dimensions.tileSize);
        if (inGrid && is_active_player && !is_move_submitted) {
            this.inTileArea = false;
            let i = 0;
            let j = 0;
            for (; i < 15; i++) {
                if (top + dimensions.tileSize / 2 <= dimensions.grid.top[i] + dimensions.tileSize) {
                    break;
                }
            }
            for (; j < 15; j++) {
                if (left + dimensions.tileSize / 2 <= dimensions.grid.left[j] + dimensions.tileSize) {
                    break;
                }
            }
            let exactTop = dimensions.grid.top[i];
            let exactLeft = dimensions.grid.left[j];
            if (Math.abs(exactLeft - left) <= dimensions.gridMagnetMargin && Math.abs(exactTop - top) <= dimensions.gridMagnetMargin && squaresFree[i][j]) {
                this.setLeft(exactLeft);
                this.setTop(exactTop);
                this.fixed = true;
                this.square = {
                    row: i,
                    column: j
                };
            } else {
                this.setLeft(left);
                this.setTop(top);
                this.fixed = false;
            }
        } else {
            this.fixed = false;
            var obstructedInTileArea = isTileAreaPositionOccupied(left + dimensions.tileSize / 2);
            if (!this.inTileArea) {
                if (obstructedInTileArea) {
                    this.setRelTop(Math.min(relTop, (dimensions.tileArea.height - 3 * dimensions.tileSize) / 2));
                } else {
                    this.setTop(top);
                    this.inTileArea = relTop >= (dimensions.tileArea.height - 3 * dimensions.tileSize) / 2;
                    if (this.inTileArea) {
                        this.lastLeftInArea = left;
                    }
                }
                this.setLeft(left);
            } else {
                let newLeft = left;
                this.setTop(top);
                if (this.lastLeftInArea && left < this.lastLeftInArea) {
                    let tilesData = getTilesDataLeftOfSorted(this.lastLeftInArea);
                    if (tilesData.length > 0) {
                        newLeft = Math.max(left, dimensions.tileArea.leftLimit + dimensions.tileSize * tilesData.length);
                        this.setLeft(newLeft);
                        tilesData.forEach((tileData, index) => {
                            tileData.tile.style.left = Math.min(tileData.left, newLeft - dimensions.tileSize * (index + 1)) - dimensions.tileArea.left;
                        });
                    } else {
                        this.setLeft(left);
                    }
                } else {
                    let tilesData = getTilesDataRightOfSorted(this.lastLeftInArea);
                    if (tilesData.length > 0) {
                        newLeft = Math.min(left, dimensions.tileArea.rightLimit - dimensions.tileSize * (tilesData.length + 1));
                        this.setLeft(newLeft);
                        tilesData.forEach((tileData, index) => {
                            tileData.tile.style.left = Math.max(tileData.left, newLeft + dimensions.tileSize * (index + 1)) - dimensions.tileArea.left;
                        });
                    } else {
                        this.setLeft(left);
                    }
                }
                this.inTileArea = relTop >= (dimensions.tileArea.height - 3 * dimensions.tileSize) / 2;
                if (this.inTileArea) {
                    this.lastLeftInArea = newLeft;
                }
            }
        }
    }).bind(this);

    this.onclickmove = (function(event) {

        var left = window.pageXOffset + event.clientX - this.dragData.distanceLeft;
        var top = window.pageYOffset + event.clientY - this.dragData.distanceTop;
        left = Math.max(0, left);
        top = Math.max(0, top);
        var relLeft = left - dimensions.tileArea.left;
        var relTop = top - dimensions.tileArea.top;

        // If in grid, apply magnet
        var inGrid = (dimensions.grid.left[0] <= left + dimensions.tileSize / 2) &&
            (left + dimensions.tileSize / 2 <= dimensions.grid.left[14] + dimensions.tileSize) &&
            (dimensions.grid.top[0] <= top + dimensions.tileSize / 2) &&
            (top + dimensions.tileSize / 2 <= dimensions.grid.top[14] + dimensions.tileSize);
        if (inGrid && is_active_player && !is_move_submitted) {
            let i = 0;
            let j = 0;
            for (; i < 15; i++) {
                if (top + dimensions.tileSize / 2 <= dimensions.grid.top[i] + dimensions.tileSize) {
                    break;
                }
            }
            for (; j < 15; j++) {
                if (left + dimensions.tileSize / 2 <= dimensions.grid.left[j] + dimensions.tileSize) {
                    break;
                }
            }
            let exactTop = dimensions.grid.top[i];
            let exactLeft = dimensions.grid.left[j];
            if (Math.abs(exactLeft - left) <= dimensions.gridMagnetMargin && Math.abs(exactTop - top) <= dimensions.gridMagnetMargin && squaresFree[i][j]) {
                this.phantomTile.style.left = exactLeft - dimensions.tileArea.left;
                this.phantomTile.style.top = exactTop - dimensions.tileArea.top;
                this.fixed = true;
                this.square = {
                    row: i,
                    column: j
                };
                return;
            }
        }
        this.phantomTile.style.top = top - dimensions.tileArea.top;
        this.phantomTile.style.left = left - dimensions.tileArea.left;
        this.fixed = false;
    }).bind(this);

    this.onfirstmouseup = (function(event) {

        // Stop listening for move and mouseup.
        document.removeEventListener("mouseup", this.onfirstmouseup);
        document.removeEventListener("mousemove", this.ondragmove);

        // Mouseup immediately after mousedown, without having moved.
        // Select tile and listen for move and next mousedown.
        if (!this.clickExpired) {
            this.moveType = "click";
            this.tile.classList.add("tile-selected");
            this.phantomTile = phantomTileElement();
            currentPlayerTileArea.appendChild(this.phantomTile);
            this.phantomTile.style.top = window.pageYOffset + event.clientY - this.dragData.distanceTop - dimensions.tileArea.top;
            this.phantomTile.style.left = window.pageXOffset + event.clientX - this.dragData.distanceLeft - dimensions.tileArea.left;
            document.addEventListener("mousemove", this.onclickmove);
            document.addEventListener("mousedown", this.onsecondclick);
            return;
        }

        // Tile has moved.
        var left = window.pageXOffset + event.clientX - this.dragData.distanceLeft;
        left = Math.max(0, left);

        // Last position was fixed in grid.
        if (this.fixed) {
            this.setToSquare(this.square);
            sendGameMessage({
                type: "place tile",
                square: this.square,
                letter: this.letter
            }, true);
            enableReject();
            enableApprove();
            return;
        }

        // Last position was not fixed.

        // Top is default.
        this.setRelTop(dimensions.tileArea.height - dimensions.tileSize) / 2;

        // Search for insertion point.
        var insertionPoint;

        if (this.inTileArea) {
            insertionPoint = tileAreaFindFreeSpotAround(this.lastLeftInArea + dimensions.tileSize / 2);
            if (!insertionPoint) {
                insertionPoint = tileAreaFindFreeSpot();
            }
        } else {
            insertionPoint = left + dimensions.tileSize / 2;
            insertionPoint = tileAreaFindFreeSpotAround(insertionPoint);
            if (!insertionPoint) {
                insertionPoint = tileAreaFindFreeSpotAround(window.pageXOffset + event.clientX);
                if (!insertionPoint) {
                    insertionPoint = tileAreaFindFreeSpotAround(this.lastLeftInArea);
                    if (!insertionPoint) {
                        insertionPoint = tileAreaFindFreeSpot();
                    }
                }
            }
        }
        this.setLeft(insertionPoint - dimensions.tileSize / 2);
        this.setStatus("tile-idle");
    }).bind(this);

    this.onsecondclick = (function(event) {
        // Stop listening for move and click.
        document.removeEventListener("mousemove", this.onclickmove);
        document.removeEventListener("mousedown", this.onsecondclick);
        currentPlayerTileArea.removeChild(this.phantomTile);
        this.phantomTile = null;
        this.tile.classList.remove("tile-selected");

        // Last position was fixed in grid.
        if (this.fixed) {
            this.setToSquare(this.square);
            sendGameMessage({
                type: "place tile",
                square: this.square,
                letter: this.letter
            }, true);
            enableReject();
            enableApprove();
            return;
        }

        // Last position was not fixed.

        // Top is default.
        this.setRelTop(dimensions.tileArea.height - dimensions.tileSize) / 2;

        // Search for insertion point.
        var insertionPoint;

        var left = window.pageXOffset + event.clientX - this.dragData.distanceLeft;
        left = Math.max(0, left);
        insertionPoint = left + dimensions.tileSize / 2;
        insertionPoint = tileAreaFindFreeSpotAround(insertionPoint);
        if (!insertionPoint) {
            insertionPoint = tileAreaFindFreeSpotAround(window.pageXOffset + event.clientX);
            if (!insertionPoint) {
                insertionPoint = tileAreaFindFreeSpotAround(this.originalLeft + dimensions.tileSize / 2);
                if (!insertionPoint) {
                    insertionPoint = tileAreaFindFreeSpot();
                }
            }
        }

        this.setLeft(insertionPoint - dimensions.tileSize / 2);
        this.setStatus("tile-idle");
    }).bind(this);

    this.putTileBack = function() {
        if (this.status == "tile-idle") {
            return;
        }
        if (this.square) {
            setSquareVacancy(this.square, true);
            this.square = null;
        }
        this.fixed = false;
        let insertionPoint = tileAreaFindFreeSpot() - dimensions.tileSize / 2;
        this.setLeft(insertionPoint);
        this.setRelTop(dimensions.tileArea.height - dimensions.tileSize) / 2;
        this.setStatus("tile-idle");
    };

    // Like put tile back, but by destroying all data associated to move.
    this.abortMove = function() {

        document.removeEventListener("mouseup", this.onfirstmouseup);
        document.removeEventListener("mousemove", this.ondragmove);
        document.removeEventListener("mousemove", this.onclickmove);
        document.removeEventListener("mousedown", this.onsecondclick);
        this.putTileBack();
        if (this.phantomTile) {
            currentPlayerTileArea.removeChild(this.phantomTile);
            this.phantomTile = null;
        }
        this.tile.classList.remove("tile-selected");
    }

    this.tile.addEventListener("mousedown", this.onmousedown);
}

function addPlayerChatMessage(player_name, message) {
    var messageDiv = document.createElement("div");
    chatMessages.appendChild(messageDiv);
    var nameSpan = document.createElement("span");
    messageDiv.appendChild(nameSpan);
    nameSpan.innerHTML = player_name + ":";
    nameSpan.classList.add("chat-player-name");
    var messageSpan = document.createElement("span");
    messageDiv.appendChild(messageSpan);
    messageSpan.innerHTML = message;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    setChatMessagesEnd();
}

function addGameChatMessage(message) {
    var messageDiv = document.createElement("div");
    messageDiv.classList.add("game-chat-message");
    messageDiv.innerHTML = message;
    chatMessages.appendChild(messageDiv);
    setChatMessagesEnd();
}

function setChatMessagesEnd() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addOldTile(tileData) {
    var tile = tileElement(tileData.letter);
    tile.classList.add("old-tile");
    if (tileData.pending) {
        tile.classList.add("tile-used");
    }
    oldTilePositioners.push(new OldTilePositioner(tile, tileData.square));
    setSquareVacancy(tileData.square, false);
}

function removeOldTile(square) {
    for (var i = 0; i < oldTilePositioners.length; i++) {
        var oldSquare = oldTilePositioners[i].square
        if (oldSquare.row == square.row && oldSquare.column == square.column) {
            oldTilePositioners[i].abortMove();
            currentPlayerTileArea.removeChild(oldTilePositioners[i].tile);
            oldTilePositioners.splice(i, 1);
            setSquareVacancy(square, true);
            document.querySelectorAll("tr")[square.row].querySelectorAll("td")[square.column].classList.remove("not-free");
            return;
        }
    }
}

function removeCurrentPlayerTile(square) {
    for (var i = 0; i < currentPlayerTilePositioners.length; i++) {
        let positioner = currentPlayerTilePositioners[i];
        if (positioner.square && positioner.square.row == square.row && positioner.square.column == square.column) {
            positioner.abortMove();
            currentPlayerTileArea.removeChild(positioner.tile);
            currentPlayerTilePositioners.splice(i, 1);
            setSquareVacancy(square, true);
            return;
        }
    }
}

function removeCurrentPlayerTiles() {
    currentPlayerTilePositioners.forEach(positioner => {
        positioner.abortMove();
        currentPlayerTileArea.removeChild(positioner.tile);
    });
    currentPlayerTilePositioners = [];
}

function setSquareVacancies(squaresFree) {
    for (var i = 0; i < 15; i++) {
        for (var j = 0; j < 15; j++) {
            setSquareVacancy({
                row: i,
                column: j
            }, squaresFree[i][j]);
        }
    }
}

function setSquareVacancy(square, free) {
    squaresFree[square.row][square.column] = free;
    if (free) {
        document.querySelectorAll("tr")[square.row].querySelectorAll("td")[square.column].classList.remove("not-free");
    } else {
        document.querySelectorAll("tr")[square.row].querySelectorAll("td")[square.column].classList.add("not-free");
    }
}

function setActivePlayer(player_id) {
    if (player_id == my_player_id) {
        is_active_player = true;
        enableChangeTiles();
    } else {
        is_active_player = false;
    }
}

function getData() {
    sendGameMessage({
        type: "get data"
    }).then(data => window.console.log(data));
}

function getRandomId() {
    return Math.random().toString().substring(2);
}

function showMoveResult(name, result) {
    calculations.innerHTML = "";
    var head = document.createElement("div");
    head.classList.add("calculation-head");
    head.innerHTML = name + "'s move:";
    calculations.append(head);
    result.words.forEach(word => {
        var wordDiv = document.createElement("div");
        calculations.append(wordDiv);
        wordDiv.classList.add("calculation-item");
        var lettersDiv = document.createElement("div");
        wordDiv.appendChild(lettersDiv);
        lettersDiv.classList.add("result-letters");
        word.letters.forEach((letterData, i) => {
            var tile = smallTileElement(letterData.letter, letterData.factor)
            tile.classList.add("result-tile");
            tile.style.left = i * dimensions.otherPlayerTileSize;
            lettersDiv.appendChild(tile);
            if (letterData.letter != " ") {
                resizeScrabbleTileTextWrapper(tile);
            }
        });
        var wordTotalDivWrapper = document.createElement("div");
        wordTotalDivWrapper.classList.add("calculation-item-text-wrapper");
        wordTotalDivWrapper.classList.add("word-total-text-wrapper");
        wordTotalDivWrapper.style.marginLeft = word.letters.length * dimensions.otherPlayerTileSize;
        wordDiv.appendChild(wordTotalDivWrapper);
        var wordTotalDiv = document.createElement("div");
        wordTotalDivWrapper.appendChild(wordTotalDiv);
        wordTotalDiv.classList.add("calculation-item-text");
        if (word.factor > 1) {
            wordTotalDiv.innerHTML += "<b>x " + word.factor + "</b>";
        }
        wordTotalDiv.innerHTML += " = " + word.total;
    });
    if (result.bonus > 0) {
        var bonusDiv = document.createElement("div");
        bonusDiv.classList.add("calculation-item");
        var bonusDivTextWrapper = document.createElement("div");
        bonusDivTextWrapper.classList.add("calculation-item-text-wrapper");
        bonusDiv.appendChild(bonusDivTextWrapper);
        var bonusDivText = document.createElement("div");
        bonusDivTextWrapper.appendChild(bonusDivText);
        bonusDivText.classList.add("calculation-item-text");
        bonusDivText.innerHTML = "Bonus: " + result.bonus;
        calculations.append(bonusDiv);
    }
    if (result.words.length > 1 || result.bonus > 0) {
        var totalDiv = document.createElement("div");
        totalDiv.classList.add("calculation-total");
        totalDiv.classList.add("calculation-item");
        var totalDivTextWrapper = document.createElement("div");
        totalDivTextWrapper.classList.add("calculation-item-text-wrapper");
        totalDiv.appendChild(totalDivTextWrapper);
        var totalDivText = document.createElement("div");
        totalDivTextWrapper.appendChild(totalDivText);
        totalDivText.classList.add("calculation-item-text");
        totalDivText.innerHTML = "Total: " + result.total;
        calculations.append(totalDiv);
    }
    document.querySelectorAll(".calculation-item").forEach(element => {
        element.style.height = dimensions.otherPlayerTileSize * 1.2;
    });
}

var scoreboardData = {
    startingPlayer: null,
    players: null,
    scoreboard: null,
    totals: null,
};

function setScoreBoard(startingPlayer, players, scoreboard, minusPoints, totals, winners) {
    scoreboardData.startingPlayer = startingPlayer;
    scoreboardData.players = players;
    scoreboardData.scoreboard = scoreboard;
    scoreboardData.minusPoints = minusPoints;
    scoreboardData.totals = totals;
    scoreboardData.winners = winners;
    var playersShifted = [];
    var startingIndex = players.findIndex(player => player.player_id == startingPlayer);
    for (var i = 0; i < players.length; i++) {
        playersShifted.push(players[(i + startingIndex) % players.length]);
    }

    scoreboardDiv.innerHTML = "";
    var scoreHead = document.createElement("div");
    scoreHead.classList.add("scoreboard-head");
    scoreHead.innerHTML = "Scoreboard";
    scoreboardDiv.append(scoreHead);

    var table = document.createElement("table");
    table.style.width = (Math.min(4, players.length) * 12) + "%";
    scoreboardDiv.appendChild(table);

    var tableFull = false;

    // If table is full, begin a new one.
    function newTableIfFull() {
        if (tableFull) {
            table = document.createElement("table");
            table.style.width = (Math.min(4, players.length) * 12) + "%";
            scoreboardDiv.appendChild(table);
            tableFull = false;
        }
    }

    var namesRow = document.createElement("tr");
    table.appendChild(namesRow);
    for (i = 0; i < playersShifted.length; i++) {
        let nameCell = document.createElement("td");
        nameCell.classList.add("scoreboard-name");
        nameCell.innerHTML = playersShifted[i].name;
        namesRow.append(nameCell);
    }

    for (var row = 0; row < scoreboard[playersShifted[0].player_id].length; row++) {
        newTableIfFull();
        let scoreRow = document.createElement("tr");
        table.appendChild(scoreRow);
        // Add score cells
        for (i = 0; i < playersShifted.length; i++) {
            let scoreCell = document.createElement("td");
            scoreCell.classList.add("scoreboard-score");
            scoreRow.append(scoreCell);
            let score = scoreboard[playersShifted[i].player_id][row];
            if (score !== undefined) {
                scoreCell.innerHTML = score;
            }
        }
        // If bottom is close to bottom of scoreboardDiv, mark table as full.
        if (getDocumentCoordinates(scoreRow).bottom + 30 > dimensions.scoreboardDivBottom) {
            tableFull = true;
        }
    }
    if (totals) {
        // Add minus row
        newTableIfFull();
        let minusRow = document.createElement("tr");
        table.appendChild(minusRow);
        for (i = 0; i < playersShifted.length; i++) {
            let minusCell = document.createElement("td");
            minusCell.classList.add("scoreboard-minus");
            minusCell.classList.add("scoreboard-score");
            minusRow.append(minusCell);
            minusCell.innerHTML = "-" + minusPoints[playersShifted[i].player_id];
        }
        if (getDocumentCoordinates(minusRow).bottom + 30 > dimensions.scoreboardDivBottom) {
            tableFull = true;
        }

        // Add totals row
        newTableIfFull();
        let totalsRow = document.createElement("tr");
        table.appendChild(totalsRow);
        for (i = 0; i < playersShifted.length; i++) {
            let totalCell = document.createElement("td");
            totalCell.classList.add("scoreboard-total");
            totalCell.classList.add("scoreboard-score");
            totalsRow.append(totalCell);
            totalCell.innerHTML = totals[playersShifted[i].player_id];
            if (winners.map(player => player.player_id).indexOf(playersShifted[i].player_id) >= 0) {
                totalCell.classList.add("score-winner");
            }
        }
    }
}

function getWinners(players, scoreTotals) {
    let winners = [];
    let maxScore = -1;
    for (var i = 0; i < players.length; i++) {
        let player_id = players[i].player_id
        if (scoreTotals[player_id] > maxScore) {
            winners = [players[i]];
            maxScore = scoreTotals[player_id];
        } else if (scoreTotals[player_id] == maxScore) {
            winners.push(players[i]);
        }
    }
    return winners;
}

function setOtherPlayerTileNumber(player_id, count) {
    for (var i = 1; i <= 7; i++) {
        let tile = document.getElementById("player-" + player_id + "-tile-" + i);
        if (tile) {
            tile.style.visibility = (i <= count) ? "visible" : "hidden";
        }
    }
}

function showOtherPlayerLetters(player_id, letters) {
    if (player_id == my_player_id) {
        return;
    }
    setOtherPlayerTileNumber(player_id, 0);
    var tileArea = document.getElementById("tile-area-player-" + player_id);
    letters.forEach((letter, i) => {
        let tile = smallTileElement(letter);
        tile.classList.add("other-player-tile-visible");
        tile.style.left = dimensions.otherPlayerTileOffset + dimensions.otherPlayerTileMargin * (i + 1) + dimensions.otherPlayerTileSize * i;
        tileArea.appendChild(tile);
        if (letter != " ") {
            resizeScrabbleTileTextWrapper(tile);
        }
    });
}

/************************************************
 * DOM functions
/************************************************/

function getDocumentCoordinates(element) {
    let box = element.getBoundingClientRect();
    return {
        top: box.top + window.pageYOffset,
        right: box.right + window.pageXOffset,
        bottom: box.bottom + window.pageYOffset,
        left: box.left + window.pageXOffset,
        height: box.height,
        width: box.width,
    };
}

function getInnerHeightWithHalfBorder(element) {
    var computed = getComputedStyle(element);
    var padding = parseInt(computed.paddingTop) + parseInt(computed.paddingBottom);
    var border = parseInt(computed.borderTopWidth) + parseInt(computed.borderBottomWidth);
    return element.clientHeight - padding + border / 2;
}
