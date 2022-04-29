<?php

/**
 * "Remember me" token.
 */
class LoginToken extends Token {
  
  /**
   * Lifetime of login token, in seconds. This is also the lifetime of the cookie.
   * @var int
   */
  protected static $lifetime = 8640000; // 100 days
  
  /**
   * Login token cookie name
   * @var string
   */
  public static $cookieName = 'remember_me';
  
  /**
   * Store token in cookie.
   * @return void
   */
  public function saveAsCookie() {
    $cookie = $this->selector . ':' . $this->token;
    $expires = time() + self::$lifetime;
    setcookie(self::$cookieName, $cookie , $expires);
  }
  
  /**
   * Check if there is a valid login token cookie, and use it to populate session variable.
   * @return void
   */
  public static function tryLogin() {
    if (isset($_SESSION['ok']) || empty($_COOKIE[self::$cookieName])) {
      // Already logged in or no login token
      return;
    }
    list($selector, $token) = explode(':', $_COOKIE[self::$cookieName]);
    // Check token
    if (self::verify($selector, $token)) {
      $_SESSION['ok'] = true;
      // Delete used token
      self::delete($selector);
      // Create new token
      (new LoginToken())->saveAsCookie();
    }
  }
}
