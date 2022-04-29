# scrabble

## History and purpose

There are plenty of online Scrabble-based mobile apps and browser games, such as the [Internet Scrabble Club](https://isc.ro/), with its very active and passionate community that includes some of the world's top players. As far as I have found, no existing applications supports games with 3 or more players. This makes sense, because nobody would play a 3-player scrabble game competitively, but it also means that the warmth of a family gathering around a Scrabble board is doomed during periods of quarantine. So I made my own. 

This Scrabble-based game is not a commercial product. It was created to play with family and friends. While I initially hesited to, I am publishing the source code now to relieve the people who are looking for the same thing as I.

## Language

The game was initially made in Dutch. I translated the game to English before publishing it here. Changing the language is an easy task. It suffices to:

* Translate the various sentences in `www/scrabble.js` and `files/joingame.php`
* Change the variable `letterValues` in `www/scrabble.js`.
* Change the variables `$letterValues` and $letterQuantities in `files/game_functions.php`.

Ideally I should separate the language aspect from the code, to make this process easier.
