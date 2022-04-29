<?php

function getDB() {
  $servername = '';
  $dbname = 'scrabble';
  $username = '';
  $password = '';
  try {
    $conn = new PDO(
      "mysql:host=$servername;dbname=$dbname",
      $username,
      $password,
      array(
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8",
      )
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $conn;
  } catch(PDOException $e) {
    error_log($e->getMessage());
  }
}
