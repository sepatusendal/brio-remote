package control

import (
	"github.com/go-vgo/robotgo"
)

// Event mirrors the INPUT message shape sent by the dashboard over the
// server relay. Not every field is used by every action.
type Event struct {
	Action string  `json:"action"` // mousemove | mousedown | mouseup | wheel | keydown | keyup
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Button string  `json:"button"` // left | right | middle
	Key    string  `json:"key"`
	DeltaY float64 `json:"deltaY"`
}

// Apply executes an input event on the local machine. Unknown actions are
// ignored rather than erroring out, since the protocol may grow over time.
func Apply(ev Event) {

	switch ev.Action {

	case "mousemove":
		robotgo.Move(int(ev.X), int(ev.Y))

	case "mousedown":
		robotgo.MoveMouse(int(ev.X), int(ev.Y))
		robotgo.Toggle(normalizeButton(ev.Button), "down")

	case "mouseup":
		robotgo.Toggle(normalizeButton(ev.Button), "up")

	case "wheel":
		// robotgo scroll amount is roughly in "lines"; DeltaY from the
		// browser is in pixels, so scale it down.
		robotgo.Scroll(0, int(ev.DeltaY/4))

	case "keydown":
		robotgo.KeyToggle(normalizeKey(ev.Key), "down")

	case "keyup":
		robotgo.KeyToggle(normalizeKey(ev.Key), "up")
	}
}

func normalizeButton(b string) string {
	if b == "" {
		return "left"
	}
	return b
}

// normalizeKey maps JS KeyboardEvent.key values to robotgo key names.
// This list covers the common non-printable keys; printable characters
// (letters, digits, punctuation) pass through unchanged.
func normalizeKey(k string) string {
	switch k {
	case "Enter":
		return "enter"
	case "Escape":
		return "esc"
	case "Backspace":
		return "backspace"
	case "Tab":
		return "tab"
	case "Shift":
		return "shift"
	case "Control":
		return "ctrl"
	case "Alt":
		return "alt"
	case "Meta":
		return "cmd"
	case "ArrowLeft":
		return "left"
	case "ArrowRight":
		return "right"
	case "ArrowUp":
		return "up"
	case "ArrowDown":
		return "down"
	case " ":
		return "space"
	default:
		return k
	}
}
