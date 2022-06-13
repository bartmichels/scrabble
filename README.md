# scrabble

## History and purpose

There are plenty of online Scrabble-based mobile apps and browser games, such as the [Internet Scrabble Club](https://isc.ro/), with its very active and passionate community that includes some of the world's top players. As far as I have found, no existing application supports games with 3 or more players. This makes sense, because nobody would play a 3-player scrabble game competitively, but it also means that the warmth of a family gathering around a Scrabble board is doomed during periods of quarantine. So I made my own.

This Scrabble-based game is not a commercial product. It was created to play with family and friends. While I initially hesited to, I am publishing the source code now to relieve the people who are looking for the same thing as I.

**→ [Live demo](https://pommetatin.be/scrabble_demo/) ←**

## Sources

The code is entirely mine. The image `www/bag-green.png` is made by me from the following public domain image: https://publicdomainvectors.org/en/free-clipart/Pile-of-money/46821.html

The style file `www/scrabble.css` uses the font `Futura Book` (OTF), which I found approximates best the real world Scrabble font. You should be able to find it for free online.

## Language

The game was initially made in Dutch. I translated the game to English before publishing it here. Changing the language is an easy task. It suffices to:

* Translate the various sentences in `www/scrabble.js` and `files/joingame.php` that appear throughout the code. (Sorry for this.)
* Change the variable `letterValues` in `www/scrabble.js`.
* Change the variables `$letterValues` and `$letterQuantities` in `files/game_functions.php`.

Ideally I should separate the language aspect from the code, to make this process easier.

## Installation

This was made for an Apache server that runs PHP 8.1 and MySQL (MariaDB). The only real reliance on Apache is in the URL rewriting in `www/.htaccess`. Installation is relatively easy:

* Create a database named `scrabble`.
* Initialize the database using `files/scrabble.sql`
* Complete `files/db_config.php` with your server name (most likely `localhost`), database username and database password.
* Choose a directory on your server (which I'll call the web root). Place all the files in `www/` into that directory (but not the folder itself), together with `Futura Book.otf` or whichever font you replace it with.
* Change the Rewrite Base in `.htaccess` to your web root.
* In `index.php`, change `WEB_ROOT` to your web root.
* Choose another directory on your server, for the rest of the files. (This should not be public because it will contain the password to your database and you don't want to risk Apache leaking that.) Places all the files in `/files` (but not `scrabble.sql`, or at least you don't need that) in that folder.
* Make sure that you `set_include_path` to your chosen path, in the beginning of `index.php`.

That's it! I used a password in order to control who can access the game. Check out `files/passvalidation.php` if you want to change the password. If you don't want a password, then... Well, as a dirty solution that doesn't require changing the code too much, you can just delete the first three `if` statements in `index.php` (which use the variable `$_SESSION['ok']`).

## Usage

### Browser support

This is made to play on desktop browsers. The design is responsive to screen size, but a too small screen will mess things up. Tablets might work, but I haven't tested them. It should work fine with Chrome, Edge, Firefox and Opera. Chrome works best because its UI takes up less space by default, but any browser should give the same result in full-screen mode. Ideally I should use canvas elements so that everything scales nicely, but I stopped working on this as soon as it worked reasonably well.

### Gameplay

Creating a game will produce a unique game id, which you can share. In the lobby you can then add and delete players. As soon as all players (and at least 2) are ready, the game starts. This game supports up to 7 players (that's how many "players" I could realistically fit around the board, design-wise), though playing with more than 4 is not a good idea regardless.

Player profiles are not protected using passwords. This was made so that you can remove or replace players during the game if their internet connection is down. You should just trust each other not to peek at each other's letters.

To decide who begins, draw letters from the green bag until a winner is decided.

You can place tiles in two ways: using drag and drop, or by clicking them and then clicking again where you want them to be.

Verifying words is not done using a dictionary, but is meant to be done using mutual agreement. The player following you decides whether to approve or reject your move. Moves cannot be undone once approved.

All the rest should speak for itself.

Have fun!

## Known issues

* Data corruption is possible because Apache will allow multiple simultaneous connections. If you spam-place and spam-remove tiles, multiple database updates can be intertwined. I have somewhat limited this by placing read and write operations as close together as possible, but this is not a robust solution. But as long as you play the game normally, even if you click fast, nothing should go wrong.
* The game interface and therefore the tile placement gets messed up on small screen sizes. If you use the entire height of your desktop screen, you should be good.
