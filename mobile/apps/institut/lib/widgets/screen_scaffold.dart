import 'package:flutter/material.dart';

/// Barre d'entête compacte pour les écrans push (Clients, Équipe, Institut).
/// Titre + bouton retour + trailing optionnel + barre de recherche optionnelle
/// intégrée juste en dessous.
class InstitutTopBar extends StatelessWidget implements PreferredSizeWidget {
  const InstitutTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onBack,
    this.showBack = true,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onBack;
  final bool showBack;
  final PreferredSizeWidget? bottom;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  static const double _height = 52;

  @override
  Size get preferredSize =>
      Size.fromHeight(_height + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    final effectiveBack = onBack ??
        () {
          if (Navigator.of(context).canPop()) {
            Navigator.of(context).pop();
          }
        };
    return Material(
      color: Colors.white,
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: _height,
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: _border)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                children: [
                  if (showBack)
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, size: 22),
                      color: _black,
                      onPressed: effectiveBack,
                      splashRadius: 20,
                      tooltip: 'Retour',
                    )
                  else
                    const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: _black,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 1),
                          Text(
                            subtitle!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: _muted,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  ?trailing,
                  SizedBox(width: trailing != null ? 6 : 8),
                ],
              ),
            ),
            if (bottom != null)
              SizedBox(
                height: bottom!.preferredSize.height,
                child: bottom,
              ),
          ],
        ),
      ),
    );
  }
}

/// Champ de recherche compact utilisé sous [InstitutTopBar] via `bottom`.
class InstitutSearchBar extends StatelessWidget implements PreferredSizeWidget {
  const InstitutSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hint = 'Rechercher…',
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String hint;

  static const _fill = Color(0xFFF5F5F5);
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFE8E8E8);

  static const double _height = 56;

  @override
  Size get preferredSize => const Size.fromHeight(_height);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _height,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: _border)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: SizedBox(
            height: 40,
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              textInputAction: TextInputAction.search,
              style: const TextStyle(fontSize: 14, height: 1.2, color: _black),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(color: _muted, fontSize: 14),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: _muted,
                ),
                prefixIconConstraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                ),
                suffixIcon: controller.text.isNotEmpty
                    ? IconButton(
                        onPressed: () {
                          controller.clear();
                          onChanged('');
                        },
                        icon: const Icon(Icons.close_rounded, size: 18),
                        color: _muted,
                        splashRadius: 16,
                        visualDensity: VisualDensity.compact,
                      )
                    : null,
                suffixIconConstraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                ),
                filled: true,
                fillColor: _fill,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _black, width: 1.2),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Puce inline (statut, tag) — visuel minimal.
class InstitutChip extends StatelessWidget {
  const InstitutChip({
    super.key,
    required this.label,
    this.color,
    this.background,
    this.icon,
  });

  final String label;
  final Color? color;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background ?? const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color ?? const Color(0xFF525252)),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color ?? const Color(0xFF525252),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
