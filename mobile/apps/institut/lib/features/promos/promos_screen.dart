import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';
import '../shared/money.dart';
import 'promo_sheets.dart';

class PromosScreen extends ConsumerStatefulWidget {
  const PromosScreen({super.key});

  @override
  ConsumerState<PromosScreen> createState() => _PromosScreenState();
}

class _PromosScreenState extends ConsumerState<PromosScreen> {
  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);

  List<InstPromo> _items = const [];
  bool _loading = true;
  String? _error;

  ({String token, String tenantId})? _session() {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return null;
    return (token: token, tenantId: tenantId);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final session = _session();
    if (session == null) {
      setState(() {
        _loading = false;
        _error = 'Session ou institut manquant';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(mobileApiProvider).fetchPromos(
            accessToken: session.token,
            tenantId: session.tenantId,
          );
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openEditor({InstPromo? promo}) async {
    final ok = await showPromoSheet(context, ref, promo: promo);
    if (ok == true) _load();
  }

  Future<void> _delete(InstPromo promo) async {
    final session = _session();
    if (session == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette promo ?'),
        content: Text(promo.code),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(mobileApiProvider).deletePromo(
            accessToken: session.token,
            tenantId: session.tenantId,
            promoId: promo.id,
          );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  String _discount(InstPromo promo) {
    if (promo.discountType == 'fixed' && (promo.discountCents ?? 0) > 0) {
      return '−${formatEuros(promo.discountCents!)}';
    }
    return '−${promo.discountPercent ?? 0} %';
  }

  String _status(InstPromo promo) {
    switch (promo.status) {
      case 'active':
        return 'Active';
      case 'scheduled':
        return 'Planifiée';
      case 'expired':
        return 'Expirée';
      case 'exhausted':
        return 'Épuisée';
      default:
        return 'Inactive';
    }
  }

  String _channels(InstPromo promo) {
    final parts = <String>[
      if (promo.channelPos) 'Caisse',
      if (promo.channelBooking) 'Résa',
      if (promo.channelWoo) 'Boutique',
    ];
    return parts.isEmpty ? 'Aucun canal' : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: InstitutTopBar(
        title: 'Promos',
        subtitle: _items.isEmpty ? null : '${_items.length} codes',
        trailing: IconButton(
          onPressed: () => _openEditor(),
          icon: const Icon(Icons.add_rounded),
          color: _black,
          tooltip: 'Nouvelle promo',
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _items.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _items.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _muted),
                        ),
                      ),
                    ],
                  )
                : ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(
                      16,
                      12,
                      16,
                      MediaQuery.viewPaddingOf(context).bottom + 32,
                    ),
                    children: [
                      if (_items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 48),
                          child: Text(
                            'Aucun code promo. Créez-en un pour la caisse, la réservation ou la boutique.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: _muted, fontSize: 14),
                          ),
                        )
                      else
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: _border),
                          ),
                          child: Column(
                            children: [
                              for (var i = 0; i < _items.length; i++) ...[
                                if (i > 0)
                                  const Divider(
                                    height: 1,
                                    thickness: 1,
                                    color: Color(0xFFF1F1F1),
                                    indent: 16,
                                  ),
                                Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: () => _openEditor(promo: _items[i]),
                                    onLongPress: () => _delete(_items[i]),
                                    child: Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                        16,
                                        14,
                                        12,
                                        14,
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  _items[i].code,
                                                  style: const TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w700,
                                                    color: _black,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  '${_items[i].name} · ${_discount(_items[i])}',
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    color: _muted,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  '${_status(_items[i])} · ${_channels(_items[i])}',
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: _muted,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const Icon(
                                            Icons.chevron_right_rounded,
                                            color: Color(0xFFB5B5B5),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}
