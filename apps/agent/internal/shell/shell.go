package shell

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"sync"
)

// Shell wraps one long-lived shell process with piped stdin/stdout/stderr.
// Commands are written to stdin one at a time; output is streamed back via
// callbacks as it arrives. A sentinel line is appended after every command
// so we can detect completion and capture the exit code, since a raw pipe
// gives no other signal that a command has finished.
type Shell struct {
	cmd   *exec.Cmd
	stdin io.WriteCloser
	mu    sync.Mutex // serializes writes to stdin

	onLine func(stream, line string)
	onDone func(exitCode int)
}

var sentinelRe = regexp.MustCompile(`^__BRIO_DONE__:(-?\d+)$`)

// New starts the shell and begins pumping its output. onLine is called for
// every non-sentinel line of stdout/stderr; onDone is called once per
// command, after all of that command's output has been delivered.
func New(onLine func(stream, line string), onDone func(exitCode int)) (*Shell, error) {

	name, args := shellCommand()
	cmd := exec.Command(name, args...)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	s := &Shell{cmd: cmd, stdin: stdin, onLine: onLine, onDone: onDone}

	go s.pump("stdout", stdout)
	go s.pump("stderr", stderr)

	return s, nil
}

func (s *Shell) pump(stream string, r io.Reader) {

	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)

	for scanner.Scan() {

		line := scanner.Text()

		if m := sentinelRe.FindStringSubmatch(line); m != nil {
			code, _ := strconv.Atoi(m[1])
			if s.onDone != nil {
				s.onDone(code)
			}
			continue
		}

		if s.onLine != nil {
			s.onLine(stream, line)
		}
	}
}

// Run writes a command to the shell's stdin, followed by a sentinel echo
// that reports its exit code. Only one command should be in flight at a
// time — the dashboard enforces this by disabling input until EXEC_DONE.
func (s *Shell) Run(command string) error {

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := fmt.Fprintln(s.stdin, command); err != nil {
		return err
	}

	_, err := fmt.Fprintln(s.stdin, doneEcho())
	return err
}

// Close terminates the shell process.
func (s *Shell) Close() {
	s.stdin.Close()
	if s.cmd.Process != nil {
		s.cmd.Process.Kill()
	}
}

func shellCommand() (string, []string) {
	if runtime.GOOS == "windows" {
		return "cmd.exe", nil
	}
	return "/bin/sh", nil
}

func doneEcho() string {
	if runtime.GOOS == "windows" {
		return "echo __BRIO_DONE__:%errorlevel%"
	}
	return `echo "__BRIO_DONE__:$?"`
}
