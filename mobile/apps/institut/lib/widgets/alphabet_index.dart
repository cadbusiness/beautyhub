import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Index A–Z style annuaire, à coller à droite d’une liste.
class AlphabetIndex extends StatelessWidget {
  const AlphabetIndex({
    super.key,
    required this.onSelect,
    required this.onDragEnd,
    this.activeLetter,
  });

  final ValueChanged<String> onSelect;
  final VoidCallback onDragEnd;
  final String? activeLetter;

  static const letters = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    '#',
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTapDown: (details) =>
              _pick(constraints.maxHeight, details.localPosition.dy),
          onTapUp: (_) => onDragEnd(),
          onTapCancel: onDragEnd,
          onVerticalDragDown: (details) =>
              _pick(constraints.maxHeight, details.localPosition.dy),
          onVerticalDragUpdate: (details) =>
              _pick(constraints.maxHeight, details.localPosition.dy),
          onVerticalDragEnd: (_) => onDragEnd(),
          onVerticalDragCancel: onDragEnd,
          child: SizedBox(
            width: 22,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final letter in letters)
                  Text(
                    letter,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      height: 1,
                      color: activeLetter == letter
                          ? const Color(0xFF6D28D9)
                          : const Color(0xFF0A0A0A),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _pick(double height, double dy) {
    if (height <= 0) return;
    final index =
        (dy / height * letters.length).floor().clamp(0, letters.length - 1);
    onSelect(letters[index]);
  }
}

class AlphabetScrubBubble extends StatelessWidget {
  const AlphabetScrubBubble({super.key, required this.letter});

  final String letter;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xE60A0A0A),
            borderRadius: BorderRadius.circular(14),
          ),
          child: SizedBox(
            width: 76,
            height: 76,
            child: Center(
              child: Text(
                letter,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

void alphabetHaptic() {
  HapticFeedback.selectionClick();
}
