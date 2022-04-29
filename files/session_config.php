<?php

// Session lifetime is 1 hour.
// That is, those who didn't check "remember me", have to log in again after 1 hour inactive.
// Those who did click "remember me", will silently have a new session_id generated when loggin in after 1 hour of inactivity.
ini_set('session.gc_maxlifetime', 3600);

ini_set('session.gc_divisor', 100);

$handler = new PHPSessionHandler();
session_set_save_handler($handler, true);
register_shutdown_function('session_write_close');
session_set_cookie_params(0);
