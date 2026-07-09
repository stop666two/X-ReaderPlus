package main

import (
	"encoding/json"
	"log"
)

func jsonStr(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		log.Printf("jsonStr marshal error: %v", err)
		return "{}"
	}
	return string(b)
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		log.Printf("mustJSON marshal error: %v", err)
		return []byte("{}")
	}
	return b
}
