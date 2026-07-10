package capture

import (
	"bytes"
	"errors"
	"image/jpeg"

	"github.com/kbinani/screenshot"
)

var ErrNoDisplay = errors.New("capture: no active display found")

// JPEG grabs the primary display (index 0) and returns it encoded as JPEG
// bytes at the given quality (1-100). It is safe to call repeatedly from a
// polling loop; each call performs a fresh capture.
func JPEG(quality int) ([]byte, error) {

	if screenshot.NumActiveDisplays() <= 0 {
		return nil, ErrNoDisplay
	}

	bounds := screenshot.GetDisplayBounds(0)

	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return nil, err
	}

	buf := new(bytes.Buffer)

	if err := jpeg.Encode(buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
