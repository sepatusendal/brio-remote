package shell

import (
	"os"
	"os/exec"
	"runtime"

	"github.com/creack/pty"
)

// Shell wraps a shell process attached to a real pseudo-terminal (pty).
// Unlike a plain piped subprocess, a pty gives the shell an actual TTY —
// so interactive programs (vim, htop, less), ANSI colors, and line editing
// all work exactly like a normal terminal. Output is raw bytes including
// escape sequences, meant to be rendered by a real terminal emulator
// (xterm.js) on the frontend rather than parsed line-by-line.
type Shell struct {
	ptmx *os.File
	cmd  *exec.Cmd
}

// New spawns the shell and begins streaming its output to onData as raw
// byte chunks, until the pty closes.
func New(onData func([]byte)) (*Shell, error) {

	name, args := shellCommand()
	cmd := exec.Command(name, args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	s := &Shell{ptmx: ptmx, cmd: cmd}

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				chunk := make([]byte, n)
				copy(chunk, buf[:n])
				onData(chunk)
			}
			if err != nil {
				return
			}
		}
	}()

	return s, nil
}

// Write sends raw input (keystrokes, pasted text) to the shell.
func (s *Shell) Write(data []byte) error {
	_, err := s.ptmx.Write(data)
	return err
}

// Resize updates the pty's window size so full-screen programs (vim, less,
// htop) reflow correctly to match the browser's terminal dimensions.
func (s *Shell) Resize(cols, rows int) error {
	return pty.Setsize(s.ptmx, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
}

// Close terminates the shell process and releases the pty.
func (s *Shell) Close() {
	s.ptmx.Close()
	if s.cmd.Process != nil {
		s.cmd.Process.Kill()
	}
}

func shellCommand() (string, []string) {
	if runtime.GOOS == "windows" {
		// creack/pty's Windows (ConPTY) support is newer/less battle-tested
		// than its Unix support — this path is best-effort.
		return "cmd.exe", nil
	}
	if shellPath := os.Getenv("SHELL"); shellPath != "" {
		return shellPath, nil
	}
	return "/bin/bash", nil
}
