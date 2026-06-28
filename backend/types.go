package main

import "encoding/json"

func jsonStr(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
