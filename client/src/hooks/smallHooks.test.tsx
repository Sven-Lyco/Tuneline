import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useGameAudio } from './useGameAudio';
import { useRoomCodeCopy } from './useRoomCodeCopy';
import { useDragScroll } from './useDragScroll';

describe('useGameAudio', () => {
  it('tracks whether the song really plays', async () => {
    const { result } = renderHook(() => useGameAudio());
    await act(async () => result.current.startSong('https://a/1.m4a'));
    expect(result.current.playing).toBe(true);

    act(() => result.current.stopSong());
    expect(result.current.playing).toBe(false);

    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('blocked'));
    await act(async () => result.current.startSong('https://a/2.m4a'));
    expect(result.current.playing).toBe(false);

    await act(async () => result.current.toggle());
    expect(result.current.playing).toBe(true);
  });

  it('changes and remembers the volume', () => {
    const { result } = renderHook(() => useGameAudio());
    act(() => result.current.changeVolume(0.4));
    expect(result.current.volume).toBe(0.4);
    expect(renderHook(() => useGameAudio()).result.current.volume).toBe(0.4);
  });
});

describe('useRoomCodeCopy', () => {
  it('copies the invite link and resets the confirmation', () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { result } = renderHook(() => useRoomCodeCopy('ABC123'));
    act(() => result.current.copyCode());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?room=ABC123`);
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.copied).toBe(false);
  });

  it('falls back to execCommand without the clipboard API', () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const { result } = renderHook(() => useRoomCodeCopy('ABC123'));
    act(() => result.current.copyCode());
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});

function DragBox({ onItem }: { onItem: () => void }) {
  const { ref, dragProps, isDragging, suppressClickIfDragged } = useDragScroll();
  return (
    <div ref={ref} data-testid="box" data-dragging={String(isDragging)} {...dragProps}>
      <button onClick={suppressClickIfDragged(onItem)}>item</button>
    </div>
  );
}

describe('useDragScroll', () => {
  it('scrolls while dragging and swallows the click that ends a drag', () => {
    const onItem = vi.fn();
    render(<DragBox onItem={onItem} />);
    const box = screen.getByTestId('box');

    fireEvent.mouseDown(box, { clientX: 100 });
    expect(box.dataset.dragging).toBe('true');
    fireEvent.mouseMove(box, { clientX: 50 });
    expect(box.scrollLeft).toBe(50);
    fireEvent.mouseUp(box);
    expect(box.dataset.dragging).toBe('false');
    fireEvent.click(screen.getByText('item'));
    expect(onItem).not.toHaveBeenCalled();

    fireEvent.mouseDown(box, { clientX: 10 });
    fireEvent.mouseLeave(box);
    fireEvent.click(screen.getByText('item'));
    expect(onItem).toHaveBeenCalledTimes(1);

    fireEvent.mouseMove(box, { clientX: 0 }); // not dragging: ignored
  });

  it('turns vertical wheel movement into horizontal scrolling', () => {
    render(<DragBox onItem={() => {}} />);
    const box = screen.getByTestId('box');
    box.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, cancelable: true }));
    expect(box.scrollLeft).toBe(30);
    box.dispatchEvent(new WheelEvent('wheel', { deltaX: 10, deltaY: 0 }));
    expect(box.scrollLeft).toBe(30);
  });
});
