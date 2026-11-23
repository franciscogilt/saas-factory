package main

import "fmt"

// CtoF convierte Celsius a Fahrenheit.
func CtoF(c float64) float64 { return c*9/5 + 32 }

func main() { fmt.Println(CtoF(100)) }
