import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_providers.dart';
import '../../widgets/screen_scaffold.dart';

class FiscalScreen extends ConsumerStatefulWidget {
  const FiscalScreen({super.key});

  @override
  ConsumerState<FiscalScreen> createState() => _FiscalScreenState();
}

class _FiscalScreenState extends ConsumerState<FiscalScreen> {
  static const _bg = Color(0xFFF5F5F5);
  static const _black = Color(0xFF0A0A0A);
  static const _muted = Color(0xFF737373);
  static const _border = Color(0xFFE5E5E5);

  InstPosFiscalSettings? _settings;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  String _countryCode = 'FR';
  String _fiscalRegime = 'standard';
  int _serviceVatBps = 2000;
  int _productVatBps = 2000;

  final _legalName = TextEditingController();
  final _legalAddress = TextEditingController();
  final _siret = TextEditingController();
  final _vatNumber = TextEditingController();

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

  @override
  void dispose() {
    _legalName.dispose();
    _legalAddress.dispose();
    _siret.dispose();
    _vatNumber.dispose();
    super.dispose();
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
      final settings = await ref.read(mobileApiProvider).fetchPosSettings(
            accessToken: session.token,
            tenantId: session.tenantId,
          );
      if (!mounted) return;
      _apply(settings);
      setState(() {
        _settings = settings;
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

  void _apply(InstPosFiscalSettings settings) {
    _countryCode = settings.countryCode;
    _fiscalRegime = settings.fiscalRegime;
    _serviceVatBps = settings.serviceVatRateBps;
    _productVatBps = settings.productVatRateBps;
    _legalName.text = settings.legalName ?? '';
    _legalAddress.text = settings.legalAddress ?? '';
    _siret.text = settings.siret ?? '';
    _vatNumber.text = settings.vatNumber ?? '';
  }

  InstTaxCountry? get _country => _settings?.catalog.country(_countryCode);

  List<InstTaxOption> get _regimes =>
      _country?.regimes ?? _settings?.catalog.regimes ?? const [];

  List<InstTaxOption> get _rates {
    final rates = [...?_country?.rates];
    if (rates.isEmpty) rates.addAll(_settings?.catalog.rates ?? const []);
    void ensure(int bps) {
      if (!rates.any((rate) => rate.bps == bps)) {
        rates.insert(
          0,
          InstTaxOption(
            id: 'custom-$bps',
            label: '${(bps / 100).toStringAsFixed(bps % 100 == 0 ? 0 : 1)} %',
            bps: bps,
            band: 'Personnalisé',
          ),
        );
      }
    }

    ensure(_serviceVatBps);
    ensure(_productVatBps);
    return rates;
  }

  bool get _exempt => _fiscalRegime == 'franchise';

  void _onCountryChanged(String? code) {
    if (code == null || code == _countryCode) return;
    final next = _settings?.catalog.country(code);
    setState(() {
      _countryCode = code;
      _fiscalRegime = next?.regimes.first.id ?? 'standard';
      if (_fiscalRegime == 'franchise') {
        _serviceVatBps = 0;
        _productVatBps = 0;
      } else {
        final suggested = next?.rates
                .where((rate) => rate.id == 'standard')
                .map((rate) => rate.bps)
                .firstOrNull ??
            2000;
        _serviceVatBps = suggested;
        _productVatBps = suggested;
      }
    });
  }

  void _onRegimeChanged(String? regime) {
    if (regime == null) return;
    setState(() {
      _fiscalRegime = regime;
      if (regime == 'franchise') {
        _serviceVatBps = 0;
        _productVatBps = 0;
      } else if (_serviceVatBps == 0 && _productVatBps == 0) {
        final suggested = _country?.rates
                .where((rate) => rate.id == 'standard')
                .map((rate) => rate.bps)
                .firstOrNull ??
            2000;
        _serviceVatBps = suggested;
        _productVatBps = suggested;
      }
    });
  }

  Future<void> _save() async {
    final session = _session();
    if (session == null || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final settings = await ref.read(mobileApiProvider).savePosSettings(
            accessToken: session.token,
            tenantId: session.tenantId,
            countryCode: _countryCode,
            fiscalRegime: _fiscalRegime,
            defaultVatRateBps: _serviceVatBps,
            serviceVatRateBps: _serviceVatBps,
            productVatRateBps: _productVatBps,
            legalName: _legalName.text.trim(),
            legalAddress: _legalAddress.text.trim(),
            vatNumber: _vatNumber.text.trim(),
            siret: _siret.text.trim(),
          );
      if (!mounted) return;
      _apply(settings);
      setState(() {
        _settings = settings;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Fiscalité enregistrée. Tickets et factures l’utilisent.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: const InstitutTopBar(
        title: 'Fiscalité & TVA',
        subtitle: 'Tickets et factures',
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_settings == null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            _error ?? 'Impossible de charger la fiscalité.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, fontSize: 13),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: _load, child: const Text('Réessayer')),
        ],
      );
    }

    final country = _country;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 12, 16, bottom + 32),
      children: [
        const _Hint(
          'Ces informations apparaissent sur chaque ticket et chaque facture. '
          'Choisissez le pays, le régime, puis les taux de TVA des soins et des produits.',
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13)),
        ],
        const SizedBox(height: 16),
        _Card(
          title: 'Régime',
          children: [
            _SelectField<String>(
              label: 'Pays',
              value: _countryCode,
              items: [
                for (final item in _settings!.catalog.countries)
                  DropdownMenuItem(value: item.code, child: Text(item.label)),
              ],
              onChanged: _saving ? null : _onCountryChanged,
            ),
            const SizedBox(height: 14),
            _SelectField<String>(
              label: 'Régime fiscal',
              value: _regimes.any((item) => item.id == _fiscalRegime)
                  ? _fiscalRegime
                  : (_regimes.firstOrNull?.id ?? _fiscalRegime),
              items: [
                for (final item in _regimes)
                  DropdownMenuItem(value: item.id, child: Text(item.label)),
              ],
              onChanged: _saving ? null : _onRegimeChanged,
            ),
          ],
        ),
        const SizedBox(height: 16),
        _Card(
          title: country?.vatName ?? 'TVA',
          children: [
            if (_exempt)
              const Text(
                'Franchise en base : TVA à 0 % sur les tickets et factures, avec la mention légale obligatoire.',
                style: TextStyle(fontSize: 13, color: _muted, height: 1.35),
              )
            else ...[
              _SelectField<int>(
                label: 'Taux soins / prestations',
                value: _serviceVatBps,
                items: [
                  for (final rate in _rates)
                    if (rate.bps != null)
                      DropdownMenuItem(
                        value: rate.bps,
                        child: Text(
                          '${rate.label}${rate.band != null ? ' · ${rate.band}' : ''}',
                        ),
                      ),
                ],
                onChanged: _saving
                    ? null
                    : (value) {
                        if (value != null) setState(() => _serviceVatBps = value);
                      },
              ),
              const SizedBox(height: 14),
              _SelectField<int>(
                label: 'Taux produits',
                value: _productVatBps,
                items: [
                  for (final rate in _rates)
                    if (rate.bps != null)
                      DropdownMenuItem(
                        value: rate.bps,
                        child: Text(
                          '${rate.label}${rate.band != null ? ' · ${rate.band}' : ''}',
                        ),
                      ),
                ],
                onChanged: _saving
                    ? null
                    : (value) {
                        if (value != null) setState(() => _productVatBps = value);
                      },
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),
        _Card(
          title: 'Identité légale',
          children: [
            _TextField(
              label: 'Raison sociale',
              controller: _legalName,
              hint: 'Nom officiel sur les factures',
            ),
            const SizedBox(height: 14),
            _TextField(
              label: 'Adresse du siège',
              controller: _legalAddress,
              hint: 'Rue, code postal, ville',
              maxLines: 2,
            ),
            const SizedBox(height: 14),
            _TextField(
              label: country?.companyIdLabel ?? 'SIRET',
              controller: _siret,
              hint: country?.companyIdLabel ?? 'SIRET',
            ),
            const SizedBox(height: 14),
            _TextField(
              label: country?.vatNumberLabel ?? 'N° TVA',
              controller: _vatNumber,
              hint: country?.vatNumberLabel ?? 'N° TVA',
            ),
          ],
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(
            backgroundColor: _black,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(_saving ? 'Enregistrement…' : 'Enregistrer'),
        ),
      ],
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        color: _FiscalScreenState._muted,
        height: 1.4,
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _FiscalScreenState._border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: _FiscalScreenState._muted,
            ),
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _SelectField<T> extends StatelessWidget {
  const _SelectField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) {
    final safeValue = items.any((item) => item.value == value) ? value : items.first.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF404040),
          ),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<T>(
          value: safeValue,
          items: items,
          onChanged: onChanged,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _FiscalScreenState._border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _FiscalScreenState._border),
            ),
          ),
        ),
      ],
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField({
    required this.label,
    required this.controller,
    required this.hint,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF404040),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _FiscalScreenState._border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _FiscalScreenState._border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _FiscalScreenState._black, width: 1.2),
            ),
          ),
        ),
      ],
    );
  }
}
