<?php

// Session handler. Open callback needs to be timing attack safe, so for simplicity we store only hashed session id's in database. (Even if not needed for all callbacks.)
class PHPSessionHandler implements SessionHandlerInterface {
  private $db;

  // Create PDO object
  public function __construct() {
    $this->db = getDB();
  }

  // Try to open session, return true on success
  public function open($save_path, $session_id) {
    return isset($this->db);
  }

  // Try to close session, return true on success
  public function close() {
    $this->db = null;
    return true;
  }

  // Read session data, return empty string on failure
  public function read($session_id) {
    try {
      $sql = "SELECT data FROM sessions WHERE session_id_hashed = :session_id_hashed LIMIT 1";
      $stmt = $this->db->prepare($sql);
      $stmt->bindParam(':session_id_hashed', $session_id_hashed, PDO::PARAM_STR);
      $session_id_hashed = hash('sha256', $session_id);
      $stmt->execute();
      if ($stmt->rowCount() == 1) {
        if ($session = $stmt->fetch(PDO::FETCH_ASSOC)) {
          return $session['data'];
        }
      }
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
    return '';
  }

  // Save session, return true on success
  public function write($sessionId, $data) {
    if (!isset($_SESSION['ok'])) {
      return true;
    }
    try {
      $sql = "REPLACE INTO sessions (session_id_hashed, access, data) VALUES (:session_id_hashed, NOW(), :data)";
      $stmt = $this->db->prepare($sql);
      $stmt->bindParam(':session_id_hashed', $sessionIdHashed, PDO::PARAM_STR);
      $stmt->bindValue(':data', $data, PDO::PARAM_STR);
      $sessionIdHashed = hash('sha256', $sessionId);
      $stmt->execute();
      return true;
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
    return false;
  }

  // Destroy session, return true on success
  // Also returns true if session was already deleted
  public function destroy($session_id) {
    try {
      $sql = 'DELETE FROM sessions WHERE session_id_hashed = :session_id_hashed';
      $stmt = $this->db->prepare($sql);
      $stmt->bindParam(':session_id_hashed', $session_id_hashed, PDO::PARAM_STR);
      $session_id_hashed = hash('sha256', $session_id);
      $stmt->execute();
      return true;
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
    return false;
  }

  // Delete sessions older than $lifetime in seconds, return true on success
  public function gc($lifetime) {
    try {
      $sql = 'DELETE FROM sessions WHERE NOW() > DATE_ADD(access, INTERVAL :lifetime SECOND)';
      $stmt = $this->db->prepare($sql);
      $stmt->bindParam(':lifetime', $lifetime);
      $stmt->execute();
      return true;
    } catch (PDOException $e) {
      error_log($e->getMessage());
    }
    return false;
  }

  public function __destruct() {
      $this->close();
  }
}
