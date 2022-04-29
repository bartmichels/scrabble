<?php
// Try to use existing session.
session_start();

// Otherwise, try to restore session using token.
LoginToken::tryLogin();
