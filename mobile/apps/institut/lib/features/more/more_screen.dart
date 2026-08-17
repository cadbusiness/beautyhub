import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../state/session_providers.dart';
import '../shared/money.dart';
import '../shared/tenant_logo.dart';

class MoreScreen extends ConsumerStatefulWidget {
  const MoreScreen({super.key});

  @override
  ConsumerState<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends ConsumerState<MoreScreen> {
  final _picker = ImagePicker();
  bool _uploadingLogo = false;

  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);
  static const _rowBg = Colors.white;

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
      case 'platform_admin':
        return 'Super admin';
      case 'brand_owner':
        return 'Propriétaire marque';
      case 'tenant_owner':
      case 'owner':
        return 'Propriétaire';
      case 'admin':
      case 'tenant_admin':
        return 'Administrateur';
      case 'manager':
      case 'tenant_manager':
        return 'Manager';
      case 'staff':
      case 'tenant_staff':
        return 'Équipe';
      case 'coach':
        return 'Coach';
      default:
        return role.replaceAll('_', ' ');
    }
  }

  Future<void> _pickAndUploadLogo() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 90,
    );
    if (picked == null) return;

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() => _uploadingLogo = true);
    try {
      final bytes = await picked.readAsBytes();
      final mime = picked.mimeType ?? 'image/jpeg';
      await ref.read(mobileApiProvider).uploadTenantLogo(
            accessToken: token,
            tenantId: tenantId,
            bytes: bytes,
            filename: picked.name,
            mimeType: mime,
          );
      ref.invalidate(tenantBrandingProvider);
      await ref.read(tenantBrandingProvider.future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload logo échoué : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingLogo = false);
    }
  }

  Future<void> _logout() async {
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
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await ref.read(selectedTenantIdProvider.notifier).select(null);
    await Supabase.instance.client.auth.signOut();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(bootstrapProvider);
    final tenantId = ref.watch(selectedTenantIdProvider);
    final tenants = ref.watch(tenantsProvider).valueOrNull ?? const [];
    final tenant = tenants.where((t) => t.id == tenantId).firstOrNull;
    final email = Supabase.instance.client.auth.currentUser?.email;
    final cashAsync = ref.watch(cashSessionProvider);
    final brandingAsync = ref.watch(tenantBrandingProvider);

    final branding = brandingAsync.valueOrNull;
    final displayName = (branding?.displayName.isNotEmpty ?? false)
        ? branding!.displayName
        : (tenant?.name ?? 'Aucun institut');
    final logoUrl = branding?.logoUrl;
    final roleText = tenant != null ? _roleLabel(tenant.role) : null;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
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
            _ProfileHero(
              logoUrl: logoUrl,
              tenantName: displayName,
              email: email,
              roleLabel: roleText,
              fallbackInitials: _initials(email),
            ),
            const SizedBox(height: 24),
            cashAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (e, st) => const SizedBox.shrink(),
              data: (session) {
                if (session == null) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: _SectionGroup(
                    title: 'Caisse',
                    children: [
                      _MenuRow(
                        leading: _StatusDot(color: Color(0xFF10B981)),
                        title: 'Session ouverte',
                        subtitle:
                            '${session.salesCount} ventes · ${formatEuros(session.totalCents)}',
                        onTap: () {
                          ref.read(cashInitialTabProvider.notifier).state = 1;
                          context.go('/app/cash');
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
            _SectionGroup(
              title: 'Gestion',
              children: [
                _MenuRow(
                  leading: _IconTile(icon: Icons.people_outline_rounded),
                  title: 'Clientes',
                  subtitle: 'Créer, rechercher et modifier les fiches',
                  onTap: () => context.go('/app/more/clients'),
                ),
                _MenuRow(
                  leading: _IconTile(icon: Icons.groups_2_outlined),
                  title: 'Équipe',
                  subtitle: 'Praticiennes de l’institut',
                  onTap: () => context.go('/app/more/team'),
                ),
                _MenuRow(
                  leading: _IconTile(icon: Icons.store_mall_directory_outlined),
                  title: 'Institut',
                  subtitle: 'Contact, adresse & horaires publics',
                  onTap: () => context.go('/app/more/institut'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _SectionGroup(
              title: 'Espace',
              children: [
                _MenuRow(
                  leading: _LogoAvatar(
                    logoUrl: logoUrl,
                    label: displayName,
                    loading: _uploadingLogo,
                  ),
                  title: 'Logo institut',
                  subtitle: _uploadingLogo
                      ? 'Envoi en cours…'
                      : 'Appuyez pour changer',
                  onTap: _uploadingLogo ? null : _pickAndUploadLogo,
                ),
                _MenuRow(
                  leading: _IconTile(icon: Icons.storefront_outlined),
                  title: 'Changer d’institut',
                  subtitle: tenants.length > 1
                      ? '${tenants.length} instituts disponibles'
                      : 'Sélectionner un autre espace',
                  onTap: () => context.go('/tenants'),
                ),
                if (roleText != null)
                  _MenuRow(
                    leading: _IconTile(icon: Icons.badge_outlined),
                    title: 'Rôle',
                    subtitle: roleText,
                    showChevron: false,
                  ),
              ],
            ),
            const SizedBox(height: 24),
            _SectionGroup(
              title: 'Compte',
              children: [
                if (email != null)
                  _MenuRow(
                    leading: _IconTile(icon: Icons.mail_outline_rounded),
                    title: email,
                    subtitle: 'Adresse de connexion',
                    showChevron: false,
                  ),
              ],
            ),
            const SizedBox(height: 24),
            _SectionGroup(
              title: 'Application',
              children: [
                _MenuRow(
                  leading: _IconTile(icon: Icons.info_outline_rounded),
                  title: bootstrap.appName,
                  subtitle: 'Version 1.0.0',
                  showChevron: false,
                ),
              ],
            ),
            const SizedBox(height: 28),
            OutlinedButton(
              onPressed: _logout,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFECACA)),
                backgroundColor: _rowBg,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout_rounded, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Se déconnecter',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: MediaQuery.viewPaddingOf(context).bottom + 16,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.logoUrl,
    required this.tenantName,
    required this.email,
    required this.roleLabel,
    required this.fallbackInitials,
  });

  final String? logoUrl;
  final String tenantName;
  final String? email;
  final String? roleLabel;
  final String fallbackInitials;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A0A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          _HeroLogo(
            logoUrl: logoUrl,
            fallbackInitials: fallbackInitials,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tenantName,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (roleLabel != null) roleLabel!,
                    if (email != null) email!,
                  ].join(' · '),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.7),
                    height: 1.35,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroLogo extends StatelessWidget {
  const _HeroLogo({required this.logoUrl, required this.fallbackInitials});

  final String? logoUrl;
  final String fallbackInitials;

  @override
  Widget build(BuildContext context) {
    const size = 52.0;
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: size,
          height: size,
          color: Colors.white,
          child: Image.network(
            logoUrl!,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _initialsFallback(),
          ),
        ),
      );
    }
    return _initialsFallback();
  }

  Widget _initialsFallback() {
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        fallbackInitials,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _SectionGroup extends StatelessWidget {
  const _SectionGroup({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      rows.add(children[i]);
      if (i < children.length - 1) {
        rows.add(const Divider(
          height: 1,
          thickness: 1,
          color: Color(0xFFF1F1F1),
          indent: 62,
        ));
      }
    }
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
              color: _MoreScreenState._muted,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: _MoreScreenState._rowBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _MoreScreenState._border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: rows,
          ),
        ),
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.leading,
    required this.title,
    this.subtitle,
    this.onTap,
    this.showChevron = true,
  });

  final Widget leading;
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
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Row(
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: Center(child: leading),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _MoreScreenState._black,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: _MoreScreenState._muted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              if (showChevron && onTap != null)
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFFB5B5B5),
                  size: 22,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconTile extends StatelessWidget {
  const _IconTile({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 18, color: _MoreScreenState._black),
    );
  }
}

class _LogoAvatar extends StatelessWidget {
  const _LogoAvatar({
    required this.logoUrl,
    required this.label,
    required this.loading,
  });

  final String? logoUrl;
  final String label;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 36,
          height: 36,
          color: Colors.white,
          child: Image.network(
            logoUrl!,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) =>
                TenantLogoAvatar(label: label, size: 36),
          ),
        ),
      );
    }
    return TenantLogoAvatar(label: label, size: 36);
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
