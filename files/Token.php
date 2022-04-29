<?php

/**
 *
 */

abstract class Token {
  
  /**
   * @var string
   */
  protected $selector;
  
  /**
   * @var string
   */
  protected $token;
  
  /**
   * Lifetime in seconds, can be overridden.
   * @var int
   */
  protected static $lifetime = 86400; // 1 day
  
  /**
   * Generate a new token and add it to the database.
   */
  public function __construct() {
    $selector = bin2hex(openssl_random_pseudo_bytes(15));
    $token = bin2hex(openssl_random_pseudo_bytes(32));
    $this->selector = $selector;
    $this->token = $token;
    $tokenHashed = hash('sha256', $token);
    $expires = time() + static::$lifetime;
    try {
      $db = getDB();
      $sql = 'INSERT INTO tokens (selector, token_hashed, expires) VALUES (:selector, :token_hashed, :expires)';
      $stmt = $db->prepare($sql);
      $stmt->bindValue(':selector', $selector, PDO::PARAM_STR);
      $stmt->bindValue(':token_hashed', $tokenHashed, PDO::PARAM_STR);
      $stmt->bindValue(':expires', date('Y-m-d H:i:s', $expires), PDO::PARAM_STR);
      if (!$stmt->execute()) {
        die('Database error.');
      }
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
  }
  
  /**
   * @param string $selector
   * @param string $token
   * @return bool
   */
  public static function verify($selector, $token) {
    // Simple length check for good measure
    if (strlen($token) > 100 || strlen($selector) > 100) {
      return false;
    }
    try {
      // Look for non-expired token in database
      $db = getDB();
      $sql = 'SELECT token_hashed FROM tokens WHERE selector = :selector AND NOW() <= expires';
      $stmt = $db->prepare($sql);
      $stmt->bindValue(':selector', $selector, PDO::PARAM_STR);
      $stmt->execute();
      $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);
      // Check if valid token
      if ($tokenData && hash_equals($tokenData['token_hashed'], hash('sha256', $token))) {
        return true;
      } else {
        return false;
      }
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
  }
  
  /**
   * Delete a token from the database
   * @param string $selector
   * @return void
   */
  public static function delete($selector) {
    try {
      $db = getDB();
      $sql = 'DELETE FROM tokens WHERE selector = :selector LIMIT 1';
      $stmt = $db->prepare($sql);
      $stmt->bindValue(':selector', $selector, PDO::PARAM_STR);
      $stmt->execute();
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
  }
}
