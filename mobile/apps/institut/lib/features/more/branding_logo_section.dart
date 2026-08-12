import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../state/session_providers.dart';
import '../shared/tenant_logo.dart';

class BrandingLogoSection extends ConsumerStatefulWidget {
  const BrandingLogoSection({super.key});

  @override
  ConsumerState<BrandingLogoSection> createState() =>
      _BrandingLogoSectionState();
}

class _BrandingLogoSectionState extends ConsumerState<BrandingLogoSection> {
  final _picker = ImagePicker();
  bool _uploading = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE8E8E8);

  Future<void> _pickAndUpload() async {
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

    setState(() {
      _uploading = true;
      _error = null;
    });

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
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final brandingAsync = ref.watch(tenantBrandingProvider);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
        child: brandingAsync.when(
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
          error: (e, _) => Text('$e', style: const TextStyle(color: _muted)),
          data: (branding) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'IDENTITÉ VISUELLE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.7,
                    color: _muted,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    TenantLogoAvatar(
                      logoUrl: branding.logoUrl,
                      label: branding.displayName,
                      size: 56,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            branding.displayName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: _black,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Logo affiché sur le tableau de bord',
                            style: TextStyle(fontSize: 12, color: _muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                OutlinedButton(
                  onPressed: _uploading ? null : _pickAndUpload,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _black,
                    side: const BorderSide(color: _black),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: _uploading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Changer le logo'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
