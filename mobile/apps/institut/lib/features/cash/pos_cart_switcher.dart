import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/pos_cart_provider.dart';
import '../../widgets/app_sheet.dart';

class PosCartSwitcher extends ConsumerWidget {
  const PosCartSwitcher({super.key});

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _amber = Color(0xFFB45309);
  static const _amberBg = Color(0xFFFFF7ED);
  static const _amberBorder = Color(0xFFFDBA74);

  static String _firstName(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return '';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  static String clientTitle(PosCartSnapshot cart) {
    final fromClient = _firstName(cart.clientName);
    if (fromClient.isNotEmpty) return fromClient;
    final fromLabel = cart.label.trim();
    if (fromLabel.isNotEmpty && !fromLabel.toLowerCase().startsWith('panier')) {
      return _firstName(fromLabel);
    }
    return 'Sans cliente';
  }

  static String ownerLine(PosCartSnapshot cart) {
    if (cart.lockedByOther) {
      final who = _firstName(cart.lockedByName);
      return who.isEmpty ? 'Dessus · une collègue' : '$who · dessus';
    }
    final staff = _firstName(cart.staffName);
    if (staff.isNotEmpty) return staff;
    return 'Libre';
  }

  Future<void> _handleError(
    BuildContext context,
    WidgetRef ref,
    Object error,
    PosCartSnapshot cart,
    Future<void> Function() retryForce,
  ) async {
    if (error is MobileApiException && error.code == 'locked') {
      final ok = await _confirmTakeover(context, cart);
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

  Future<bool?> _confirmTakeover(
    BuildContext context,
    PosCartSnapshot cart,
  ) {
    final who = _firstName(cart.lockedByName);
    final title = who.isEmpty ? 'Panier occupé' : '$who est dessus';
    final detail = [
      clientTitle(cart),
      if (cart.itemCount > 0)
        cart.itemCount == 1 ? '1 article' : '${cart.itemCount} articles',
    ].join(' · ');
    return showAppSheet<bool>(
      context: context,
      isScrollControlled: false,
      builder: (ctx) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E5E5),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: _black,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                detail,
                style: const TextStyle(fontSize: 14, color: _muted),
              ),
              const SizedBox(height: 10),
              const Text(
                'Ouvrir ce panier prend la main. Elle peut perdre ce qu’elle vient de saisir.',
                style: TextStyle(fontSize: 13, height: 1.35, color: _muted),
              ),
              const SizedBox(height: 18),
              OutlinedButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Laisser'),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Ouvrir quand même'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _select(
    BuildContext context,
    WidgetRef ref,
    PosCartSnapshot cart,
  ) async {
    final session = ref.read(posCartSessionProvider);
    if (cart.id == session.activeCartId) return;
    if (cart.lockedByOther) {
      final ok = await _confirmTakeover(context, cart);
      if (ok != true || !context.mounted) return;
      try {
        await ref
            .read(posCartSessionProvider.notifier)
            .switchTo(cart.id, force: true);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$e')),
          );
        }
      }
      return;
    }
    try {
      await ref.read(posCartSessionProvider.notifier).switchTo(cart.id);
    } catch (e) {
      if (!context.mounted) return;
      await _handleError(
        context,
        ref,
        e,
        cart,
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
        cart,
        () =>
            ref.read(posCartSessionProvider.notifier).abandon(cart.id, force: true),
      );
    }
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
                  child: _CartTicket(
                    title: clientTitle(cart),
                    owner: ownerLine(cart),
                    items: cart.itemCount,
                    selected: cart.id == session.activeCartId,
                    occupied: cart.lockedByOther,
                    onTap: () => _select(context, ref, cart),
                    onDelete: cart.id == session.activeCartId &&
                            !cart.lockedByOther
                        ? () => _abandon(context, ref, cart)
                        : null,
                  ),
                ),
              if (session.carts.length < 8)
                _AddTicket(onTap: () => _add(context, ref)),
            ],
          ),
        ),
        if (active?.lockedByOther == true) ...[
          const SizedBox(height: 8),
          Text(
            active?.lockedByName != null
                ? '${_firstName(active!.lockedByName)} est dessus · lecture seule'
                : 'Une collègue est dessus · lecture seule',
            style: const TextStyle(
              fontSize: 12,
              color: _amber,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _CartTicket extends StatelessWidget {
  const _CartTicket({
    required this.title,
    required this.owner,
    required this.items,
    required this.selected,
    required this.occupied,
    required this.onTap,
    this.onDelete,
  });

  final String title;
  final String owner;
  final int items;
  final bool selected;
  final bool occupied;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final bg = selected
        ? PosCartSwitcher._black
        : occupied
            ? PosCartSwitcher._amberBg
            : Colors.white;
    final titleColor = selected ? Colors.white : PosCartSwitcher._black;
    final ownerColor = selected
        ? Colors.white.withValues(alpha: 0.78)
        : occupied
            ? PosCartSwitcher._amber
            : PosCartSwitcher._muted;
    final border = selected
        ? PosCartSwitcher._black
        : occupied
            ? PosCartSwitcher._amberBorder
            : const Color(0xFFE5E5E5);

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        onLongPress: onDelete,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 124,
          padding: const EdgeInsets.fromLTRB(12, 9, 10, 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                  ),
                  if (onDelete != null && selected) ...[
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: onDelete,
                      child: Icon(
                        Icons.close,
                        size: 14,
                        color: titleColor.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 3),
              Row(
                children: [
                  if (occupied) ...[
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: PosCartSwitcher._amber,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                  ],
                  Expanded(
                    child: Text(
                      items > 0 ? '$owner  ·  $items' : owner,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: ownerColor,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddTicket extends StatelessWidget {
  const _AddTicket({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E5E5)),
          ),
          child: const Icon(Icons.add, size: 20, color: PosCartSwitcher._black),
        ),
      ),
    );
  }
}
