import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';

class PosCartSwitcher extends ConsumerWidget {
  const PosCartSwitcher({super.key});

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);

  Future<void> _handleError(
    BuildContext context,
    WidgetRef ref,
    Object error,
    Future<void> Function() retryForce,
  ) async {
    if (error is MobileApiException && error.code == 'locked') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Panier en cours'),
          content: Text(
            error.message.isNotEmpty
                ? '${error.message}\nReprendre quand même ?'
                : 'En cours sur une autre tablette. Reprendre quand même ?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reprendre'),
            ),
          ],
        ),
      );
      if (ok == true) {
        try {
          await retryForce();
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('$e')),
            );
          }
        }
      }
      return;
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error')),
      );
    }
  }

  Future<void> _select(
    BuildContext context,
    WidgetRef ref,
    PosCartSnapshot cart,
  ) async {
    final session = ref.read(posCartSessionProvider);
    if (cart.id == session.activeCartId) return;
    try {
      await ref.read(posCartSessionProvider.notifier).switchTo(cart.id);
    } catch (e) {
      if (!context.mounted) return;
      await _handleError(
        context,
        ref,
        e,
        () => ref
            .read(posCartSessionProvider.notifier)
            .switchTo(cart.id, force: true),
      );
    }
  }

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(posCartSessionProvider.notifier).createEmpty();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    }
  }

  Future<void> _abandon(
    BuildContext context,
    WidgetRef ref,
    PosCartSnapshot cart,
  ) async {
    try {
      await ref.read(posCartSessionProvider.notifier).abandon(cart.id);
    } catch (e) {
      if (!context.mounted) return;
      await _handleError(
        context,
        ref,
        e,
        () =>
            ref.read(posCartSessionProvider.notifier).abandon(cart.id, force: true),
      );
    }
  }

  String _pillLabel(PosCartSnapshot cart) {
    final name = cart.label.trim().isEmpty ? 'Panier' : cart.label.trim();
    if (cart.itemCount <= 0) return name;
    return '$name · ${cart.itemCount} art.';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(posCartSessionProvider);
    if (session.carts.isEmpty && !session.loading) {
      return const SizedBox.shrink();
    }
    final active = session.active;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final cart in session.carts)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _CartPill(
                    label: _pillLabel(cart),
                    selected: cart.id == session.activeCartId,
                    locked: cart.lockedByOther,
                    onTap: () => _select(context, ref, cart),
                    onDelete: cart.itemCount == 0 ||
                            cart.id == session.activeCartId
                        ? () => _abandon(context, ref, cart)
                        : null,
                  ),
                ),
              if (session.carts.length < 8)
                _AddPill(onTap: () => _add(context, ref)),
            ],
          ),
        ),
        if (active?.lockedByOther == true) ...[
          const SizedBox(height: 8),
          Text(
            active?.lockedByName != null
                ? 'En cours (${active!.lockedByName}). Lecture seule.'
                : 'En cours sur une autre tablette. Lecture seule.',
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF92400E),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _CartPill extends StatelessWidget {
  const _CartPill({
    required this.label,
    required this.selected,
    required this.locked,
    required this.onTap,
    this.onDelete,
  });

  final String label;
  final bool selected;
  final bool locked;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? PosCartSwitcher._black : Colors.white;
    final fg = selected ? Colors.white : PosCartSwitcher._muted;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        onLongPress: onDelete,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 7, 8, 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? PosCartSwitcher._black
                  : const Color(0xFFE5E5E5),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (locked) ...[
                Icon(Icons.lock_outline, size: 13, color: fg),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
              if (onDelete != null && selected)
                GestureDetector(
                  onTap: onDelete,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Icon(Icons.close, size: 14, color: fg),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddPill extends StatelessWidget {
  const _AddPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE5E5E5)),
          ),
          child: const Icon(Icons.add, size: 18, color: PosCartSwitcher._black),
        ),
      ),
    );
  }
}
