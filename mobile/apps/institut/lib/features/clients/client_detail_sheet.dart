import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

Future<void> showClientDetailSheet({
  required BuildContext context,
  required InstClient client,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _ClientDetailSheet(client: client),
  );
}

class _ClientDetailSheet extends StatelessWidget {
  const _ClientDetailSheet({required this.client});

  final InstClient client;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _rowBg = Color(0xFFF9FAFB);

  void _copy(BuildContext context, String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copié'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final createdAt = DateFormat('d MMM y', 'fr_FR').format(client.createdAt);

    return FractionallySizedBox(
      heightFactor: 0.88,
      child: Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: _border,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    client.displayName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: _black,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 22),
                  color: _muted,
                  splashRadius: 20,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Ajoutée le $createdAt',
              style: const TextStyle(fontSize: 12, color: _muted),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                _Section(
                  title: 'Contact',
                  children: [
                    if (client.email != null)
                      _InfoRow(
                        icon: Icons.mail_outline_rounded,
                        label: client.email!,
                        onCopy: () =>
                            _copy(context, client.email!, 'Email'),
                      ),
                    if (client.phone != null)
                      _InfoRow(
                        icon: Icons.phone_outlined,
                        label: client.phone!,
                        onCopy: () =>
                            _copy(context, client.phone!, 'Téléphone'),
                      ),
                    if (client.email == null && client.phone == null)
                      const _EmptyRow(
                        icon: Icons.contact_page_outlined,
                        label: 'Aucun contact enregistré.',
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                _Section(
                  title: 'Préférences',
                  children: [
                    _InfoRow(
                      icon: Icons.mail_outline_rounded,
                      label: client.marketingOptIn
                          ? 'Marketing autorisé'
                          : 'Marketing désactivé',
                      trailing: client.marketingOptIn
                          ? _Badge.green('Actif')
                          : _Badge.gray('Refusé'),
                    ),
                    _InfoRow(
                      icon: Icons.badge_outlined,
                      label: client.hasAccount
                          ? 'Compte cliente activé'
                          : 'Pas de compte cliente',
                      trailing: client.hasAccount
                          ? _Badge.blue('Activé')
                          : _Badge.gray('Aucun'),
                    ),
                  ],
                ),
                if (client.tags.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _Section(
                    title: 'Étiquettes',
                    padded: true,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: client.tags
                            .map(
                              (t) => Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF3F4F6),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  t,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF404040),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                const Text(
                  'Historique et notes détaillées disponibles sur le web.',
                  style: TextStyle(fontSize: 12, color: _muted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.padded = false,
  });

  final String title;
  final List<Widget> children;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: _ClientDetailSheet._muted,
            ),
          ),
        ),
        Container(
          padding: padded ? const EdgeInsets.all(12) : EdgeInsets.zero,
          decoration: BoxDecoration(
            color: _ClientDetailSheet._rowBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _ClientDetailSheet._border),
          ),
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    this.onCopy,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onCopy;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onCopy,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: _ClientDetailSheet._muted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  color: _ClientDetailSheet._black,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (trailing != null)
              trailing!
            else if (onCopy != null)
              const Icon(
                Icons.copy_rounded,
                size: 16,
                color: _ClientDetailSheet._muted,
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: _ClientDetailSheet._muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: _ClientDetailSheet._muted,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.background,
  });

  factory _Badge.green(String label) => _Badge(
        label: label,
        color: const Color(0xFF065F46),
        background: const Color(0xFFD1FAE5),
      );

  factory _Badge.blue(String label) => _Badge(
        label: label,
        color: const Color(0xFF1E40AF),
        background: const Color(0xFFDBE7FE),
      );

  factory _Badge.gray(String label) => _Badge(
        label: label,
        color: const Color(0xFF525252),
        background: const Color(0xFFF1F1F1),
      );

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
