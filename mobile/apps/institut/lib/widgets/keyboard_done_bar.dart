import 'package:flutter/material.dart';

void dismissKeyboard() {
  FocusManager.instance.primaryFocus?.unfocus();
}

/// Barre « OK » au-dessus du clavier iOS (le pavé numérique n’a pas de Fermer).
class KeyboardDoneHost extends StatelessWidget {
  const KeyboardDoneHost({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Stack(
      children: [
        child,
        if (inset > 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: inset,
            child: Material(
              color: const Color(0xFFF3F4F6),
              elevation: 6,
              child: SizedBox(
                height: 44,
                child: Row(
                  children: [
                    const SizedBox(width: 12),
                    const Text(
                      'Clavier',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF737373),
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: dismissKeyboard,
                      child: const Text(
                        'OK',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0A0A0A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
