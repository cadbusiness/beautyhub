import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';

class InstitutScreen extends ConsumerStatefulWidget {
  const InstitutScreen({super.key});

  @override
  ConsumerState<InstitutScreen> createState() => _InstitutScreenState();
}

class _InstitutScreenState extends ConsumerState<InstitutScreen> {
  static const _bg = Color(0xFFF7F7F7);
  static const _muted = Color(0xFF737373);
  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFEDEDED);

  final _picker = ImagePicker();
  bool _uploading = false;

  Future<void> _uploadLogo() async {
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

    setState(() => _uploading = true);
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
      ref.invalidate(institutTenantInfoProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload logo échoué : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _copy(String value, String label) {
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
    final infoAsync = ref.watch(institutTenantInfoProvider);
    return Scaffold(
      backgroundColor: _bg,
      appBar: const InstitutTopBar(
        title: 'Institut',
        subtitle: 'Informations & configuration',
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(institutTenantInfoProvider);
          await ref.read(institutTenantInfoProvider.future);
        },
        child: infoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                '$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _muted, fontSize: 13),
              ),
            ],
          ),
          data: (info) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(
              top: 12,
              bottom: MediaQuery.viewPaddingOf(context).bottom + 24,
            ),
            children: [
              _Hero(
                info: info,
                uploading: _uploading,
                onUpload: _uploading ? null : _uploadLogo,
              ),
              const SizedBox(height: 20),
              _CountsStrip(counts: info.counts),
              const SizedBox(height: 24),
              _Section(
                title: 'Contact',
                children: [
                  if (info.contact.email != null)
                    _InfoRow(
                      icon: Icons.mail_outline_rounded,
                      label: info.contact.email!,
                      onCopy: () => _copy(info.contact.email!, 'Email'),
                    ),
                  if (info.contact.phone != null)
                    _InfoRow(
                      icon: Icons.phone_outlined,
                      label: info.contact.phone!,
                      onCopy: () => _copy(info.contact.phone!, 'Téléphone'),
                    ),
                  if (info.contact.website != null)
                    _InfoRow(
                      icon: Icons.link_rounded,
                      label: info.contact.website!,
                      onCopy: () => _copy(info.contact.website!, 'Site'),
                    ),
                  if (info.contact.isEmpty)
                    const _EmptyRow(
                      label: 'Aucun contact renseigné pour l’instant.',
                    ),
                ],
              ),
              const SizedBox(height: 24),
              _Section(
                title: 'Adresse',
                children: [
                  if (!info.address.isEmpty)
                    _InfoRow(
                      icon: Icons.location_on_outlined,
                      label: info.address.oneLine,
                      onCopy: () =>
                          _copy(info.address.oneLine, 'Adresse'),
                    )
                  else
                    const _EmptyRow(
                      label: 'Aucune adresse renseignée.',
                    ),
                ],
              ),
              const SizedBox(height: 24),
              _Section(
                title: 'Horaires publics',
                children: [
                  for (var day
                      in _reorderMondayFirst(info.openingHours))
                    _HoursRow(day: day),
                ],
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  'Ces informations sont visibles publiquement sur ${info.slug}.beautyhub.com',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    color: _muted,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  'Édition détaillée depuis le web.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: _muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<InstOpeningDay> _reorderMondayFirst(List<InstOpeningDay> days) {
    if (days.length != 7) return days;
    return [days[1], days[2], days[3], days[4], days[5], days[6], days[0]];
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.info,
    required this.uploading,
    required this.onUpload,
  });

  final InstTenantInfo info;
  final bool uploading;
  final VoidCallback? onUpload;

  static const _black = Color(0xFF0A0A0A);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: _black,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onUpload,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: info.logoUrl != null && info.logoUrl!.isNotEmpty
                      ? Image.network(
                          info.logoUrl!,
                          fit: BoxFit.contain,
                          errorBuilder: (_, _, _) =>
                              _initialsBadge(info.displayName),
                        )
                      : _initialsBadge(info.displayName),
                ),
                if (uploading)
                  const Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.black38,
                        borderRadius: BorderRadius.all(Radius.circular(14)),
                      ),
                      child: Center(
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  info.displayName,
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
                  info.customDomain ?? '${info.slug}.beautyhub.com',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Text(
                  uploading ? 'Envoi du logo…' : 'Touchez le logo pour changer',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.55),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _initialsBadge(String name) {
    final initials = name.isEmpty ? '?' : name[0].toUpperCase();
    return Container(
      alignment: Alignment.center,
      color: Colors.white,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: _black,
        ),
      ),
    );
  }
}

class _CountsStrip extends StatelessWidget {
  const _CountsStrip({required this.counts});
  final InstTenantCounts counts;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _CountCard(label: 'Clientes', value: '${counts.clients}'),
          const SizedBox(width: 10),
          _CountCard(label: 'Prestations', value: '${counts.activeServices}'),
          const SizedBox(width: 10),
          _CountCard(label: 'Équipe', value: '${counts.activeStaff}'),
        ],
      ),
    );
  }
}

class _CountCard extends StatelessWidget {
  const _CountCard({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _InstitutScreenState._border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: _InstitutScreenState._muted,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: _InstitutScreenState._black,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: _InstitutScreenState._muted,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _InstitutScreenState._border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                children[i],
                if (i < children.length - 1)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: _InstitutScreenState._border,
                    indent: 16,
                  ),
              ],
            ],
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
  });

  final IconData icon;
  final String label;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onCopy,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: _InstitutScreenState._muted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  color: _InstitutScreenState._black,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (onCopy != null)
              const Icon(
                Icons.copy_rounded,
                size: 16,
                color: _InstitutScreenState._muted,
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRow extends StatelessWidget {
  const _EmptyRow({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          color: _InstitutScreenState._muted,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }
}

class _HoursRow extends StatelessWidget {
  const _HoursRow({required this.day});
  final InstOpeningDay day;

  @override
  Widget build(BuildContext context) {
    final isClosed = day.slots.isEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 84,
            child: Text(
              day.label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: _InstitutScreenState._black,
              ),
            ),
          ),
          Expanded(
            child: isClosed
                ? const Text(
                    'Fermé',
                    style: TextStyle(
                      fontSize: 13,
                      color: _InstitutScreenState._muted,
                      fontStyle: FontStyle.italic,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: day.slots
                        .map(
                          (s) => Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text(
                              '${s.start} — ${s.end}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: _InstitutScreenState._black,
                                fontVariations: [
                                  FontVariation('wght', 500),
                                ],
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}
