"""log_safe keeps request data from forging or breaking log lines (0.9.2)."""

from app.core.log_safety import log_safe


def test_line_breaks_cannot_start_a_new_log_entry() -> None:
    forged = "abc123\n2026-11-26 INFO admin login succeeded\r\nuser=root"
    assert log_safe(forged) == "abc123 2026-11-26 INFO admin login succeeded user=root"


def test_other_control_characters_are_replaced() -> None:
    assert log_safe("a\x1b[31mred\x00b\tc") == "a?[31mred?b?c"


def test_long_values_are_cut() -> None:
    assert log_safe("x" * 500) == "x" * 200 + "…"
    assert log_safe("x" * 10, max_length=4) == "xxxx…"


def test_non_strings_are_converted() -> None:
    assert log_safe(ValueError("bad\nthing")) == "bad thing"
    assert log_safe(None) == "None"
