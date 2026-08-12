import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import '../shared/tenant_logo.dart';
import 'branding_logo_section.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  String _initials(String? email) {
    if (email == null || email.isEmpty) return '?';
    final local = email.split('@').first;
    if (local.isEmpty) return '?';
    final parts = local.split(RegExp(r'[._-]+')).where((p) => p.isNotEmpty);
    final letters = parts.take(2).map((p) => p[0].toUpperCase());
    final joined = letters.join();
    return joined.isEmpty ? local[0].toUpperCase() : joined;
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Équipe';
      default:
        return role;
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: const Text(
          'Vous devrez vous reconnecter pour accéder à votre institut.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await ref.read(selectedTenantIdProvider.notifier).select(null);
    await Supabase.instance.client.auth.signOut();
    if (context.mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(bootstrapProvider);
    final tenantId = ref.watch(selectedTenantIdProvider);
    final tenants = ref.watch(tenantsProvider).valueOrNull ?? const [];
    final tenant = tenants.where((t) => t.id == tenantId).firstOrNull;
    final email = Supabase.instance.client.auth.currentUser?.email;
    final cashAsync = ref.watch(cashSessionProvider);
    final brandingAsync = ref.watch(tenantBrandingProvider);

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            const Text(
              'Plus',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: _black,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 20),
            brandingAsync.when(
              loading: () => _ProfileHero(
                initials: _initials(email),
                appName: bootstrap.appName,
                tenantName: tenant?.name ?? 'Aucun institut',
                role: tenant != null ? _roleLabel(tenant.role) : null,
              ),
              error: (_, __) => _ProfileHero(
                initials: _initials(email),
                appName: bootstrap.appName,
                tenantName: tenant?.name ?? 'Aucun institut',
                role: tenant != null ? _roleLabel(tenant.role) : null,
              ),
              data: (branding) => _ProfileHero(
                initials: _initials(email),
                appName: bootstrap.appName,
                tenantName: branding.displayName.isNotEmpty
                    ? branding.displayName
                    : (tenant?.name ?? 'Aucun institut'),
                role: tenant != null ? _roleLabel(tenant.role) : null,
                logoUrl: branding.logoUrl,
              ),
            ),
            const SizedBox(height: 16),
            const BrandingLogoSection(),
            cashAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (e, st) => const SizedBox.shrink(),
              data: (session) {
                if (session == null) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _SectionCard(
                    title: 'Caisse',
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                            color: Color(0xFF22C55E),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Session ouverte',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: _black,
                                ),
                              ),
                              Text(
                                '${session.salesCount} ventes · ${formatEuros(session.totalCents)}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: _muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            ref.read(cashInitialTabProvider.notifier).state = 1;
                            context.go('/app/cash');
                          },
                          child: const Text('Voir'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            _SectionCard(
              title: 'Institut',
              child: Column(
                children: [
                  _MenuRow(
                    icon: Icons.storefront_outlined,
                    title: 'Changer d’institut',
                    subtitle: tenants.length > 1
                        ? '${tenants.length} instituts disponibles'
                        : 'Sélectionner un autre espace',
                    onTap: () => context.go('/tenants'),
                  ),
                  if (tenant != null) ...[
                    const Divider(height: 1, color: _border),
                    _MenuRow(
                      icon: Icons.badge_outlined,
                      title: 'Rôle',
                      subtitle: _roleLabel(tenant.role),
                      showChevron: false,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Compte',
              child: Column(
                children: [
                  if (email != null)
                    _MenuRow(
                      icon: Icons.mail_outline,
                      title: email,
                      subtitle: 'Adresse de connexion',
                      showChevron: false,
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Application',
              child: _MenuRow(
                icon: Icons.info_outline,
                title: bootstrap.appName,
                subtitle: 'Version 1.0.0',
                showChevron: false,
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => _logout(context, ref),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFB91C1C),
                side: const BorderSide(color: Color(0xFFFCA5A5)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Se déconnecter',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.initials,
    required this.appName,
    required this.tenantName,
    this.role,
    this.logoUrl,
  });

  final String initials;
  final String appName;
  final String tenantName;
  final String? role;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: MoreScreen._black,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          if (logoUrl != null && logoUrl!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                logoUrl!,
                width: 56,
                height: 56,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => TenantLogoAvatar(
                  label: tenantName,
                  size: 56,
                  primaryColor: Colors.white.withValues(alpha: 0.12),
                ),
              ),
            )
          else
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: Text(
                initials,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tenantName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  appName,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.65),
                  ),
                ),
                if (role != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      role!.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: MoreScreen._border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
                color: MoreScreen._muted,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 8, 6, 6),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.showChevron = true,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F3F3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: MoreScreen._black),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: MoreScreen._black,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: MoreScreen._muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (showChevron && onTap != null)
                const Icon(
                  Icons.chevron_right,
                  color: MoreScreen._muted,
                  size: 22,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
