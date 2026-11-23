package main

import "testing"

func TestCtoF(t *testing.T) {
	if got := CtoF(100); got != 212 {
		t.Fatalf("CtoF(100) = %v, se esperaba 212", got)
	}
}
