<?php
function verifyPassword($password) {
    return password_verify($password, password_hash('my_password', PASSWORD_DEFAULT));
}
