import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../../../widgets/searchable_picker.dart';

Future<bool> showEditAppointmentSheet(
  BuildContext context,
  DayAppointment appointment,
) async {
  final updated = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(ctx).height * 0.92,
        ),
        child: _EditAppointmentSheet(appointment: appointment),
      ),
    ),
  );
  return updated == true;
}

class _AddedService {
  const _AddedService({
    required this.id,
    required this.name,
    required this.durationMin,
    required this.priceCents,
  });

  final String id;
  final String name;
  final int durationMin;
  final int priceCents;
}

class _EditAppointmentSheet extends ConsumerStatefulWidget {
  const _EditAppointmentSheet({required this.appointment});

  final DayAppointment appointment;

  @override
  ConsumerState<_EditAppointmentSheet> createState() =>
      _EditAppointmentSheetState();
}

class _EditAppointmentSheetState extends ConsumerState<_EditAppointmentSheet> {
  late DateTime _date;
  late TimeOfDay _time;
  late String? _serviceId;
  late final TextEditingController _notes;
  List<ServiceExtraConfig> _extraCatalog = const [];
  Map<String, int> _extraQty = {};
  List<_AddedService> _added = const [];
  bool _extrasReady = false;
  bool _loadingExtras = false;
  bool _saving = false;
  String? _error;

  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFE5E5E5);
  static const _muted = Color(0xFF737373);

  @override
  void initState() {
    super.initState();
    final starts = widget.appointment.startsAt;
    _date = DateTime(starts.year, starts.month, starts.day);
    _time = TimeOfDay(hour: starts.hour, minute: starts.minute);
    _serviceId = widget.appointment.serviceId;
    _notes = TextEditingController(text: widget.appointment.notes ?? '');
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadExtras());
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  DateTime get _startsAt => DateTime(
        _date.year,
        _date.month,
        _date.day,
        _time.hour,
        _time.minute,
      );

  List<PosCatalogItem> _catalogServices(PosContext pos) {
    return pos.catalog
        .where(
          (item) => item.type == 'service' && item.visibility != 'extra_only',
        )
        .toList();
  }

  int _estimatedMinutes(List<PosCatalogItem> services) {
    final main = _selectedService(services);
    final base = main?.durationMin ?? widget.appointment.serviceDurationMin;
    if (base == null) {
      final slot = widget.appointment.endsAt
          .difference(widget.appointment.startsAt)
          .inMinutes;
      return slot < 15 ? 15 : slot;
    }
    var total = base;
    for (final extra in _extraCatalog) {
      final qty = _extraQty[extra.extraServiceId] ?? 0;
      if (qty > 0) total += extra.durationMin * qty;
    }
    for (final added in _added) {
      total += added.durationMin;
    }
    return total < 15 ? 15 : total;
  }

  PosCatalogItem? _selectedService(List<PosCatalogItem> services) {
    if (_serviceId == null) return null;
    for (final service in services) {
      if (service.id == _serviceId) return service;
    }
    return null;
  }

  List<BookingExtraLine> _extrasPayload() {
    final lines = <BookingExtraLine>[];
    for (final extra in _extraCatalog) {
      final qty = _extraQty[extra.extraServiceId] ?? 0;
      if (qty > 0) {
        lines.add(BookingExtraLine(
          serviceId: extra.extraServiceId,
          quantity: qty,
        ));
      }
    }
    for (final added in _added) {
      lines.add(BookingExtraLine(serviceId: added.id, quantity: 1));
    }
    return lines;
  }

  Future<void> _loadExtras() async {
    final serviceId = _serviceId;
    if (serviceId == null || serviceId.isEmpty) {
      setState(() {
        _extraCatalog = const [];
        _extraQty = {};
        _loadingExtras = false;
        _seedAddedFromAppointment(const []);
      });
      return;
    }

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() => _loadingExtras = true);
    try {
      final catalog = await ref.read(mobileApiProvider).fetchServiceExtras(
            accessToken: token,
            tenantId: tenantId,
            serviceId: serviceId,
          );
      if (!mounted) return;
      final qty = <String, int>{};
      for (final extra in catalog) {
        if (extra.minQty > 0) qty[extra.extraServiceId] = extra.minQty;
      }
      for (final existing in widget.appointment.extras) {
        if (catalog.any((c) => c.extraServiceId == existing.serviceId)) {
          qty[existing.serviceId] = existing.quantity;
        }
      }
      setState(() {
        _extraCatalog = catalog;
        _extraQty = qty;
        _loadingExtras = false;
        _seedAddedFromAppointment(catalog);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _extraCatalog = const [];
        _extraQty = {};
        _loadingExtras = false;
        _seedAddedFromAppointment(const []);
      });
    }
  }

  void _seedAddedFromAppointment(List<ServiceExtraConfig> catalog) {
    if (_extrasReady) return;
    _extrasReady = true;
    _added = widget.appointment.extras
        .where(
          (extra) =>
              extra.serviceId != _serviceId &&
              !catalog.any((c) => c.extraServiceId == extra.serviceId),
        )
        .map(
          (extra) => _AddedService(
            id: extra.serviceId,
            name: extra.name,
            durationMin: extra.durationMin,
            priceCents: extra.priceCents ?? 0,
          ),
        )
        .toList();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _pickService(List<PosCatalogItem> services) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une prestation',
      items: _serviceItems(services),
      selectedId: _serviceId,
      searchHint: 'Rechercher une prestation…',
      emptyMessage: 'Aucune prestation trouvée.',
    );
    if (picked == null) return;
    setState(() {
      _serviceId = picked.id;
      _extraCatalog = const [];
      _extraQty = {};
      _added = _added.where((s) => s.id != picked.id).toList();
    });
    await _loadExtras();
  }

  Future<void> _addService(List<PosCatalogItem> services) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Ajouter une prestation',
      items: _serviceItems(
        services.where((s) => s.id != _serviceId).toList(),
      ),
      searchHint: 'Rechercher une prestation…',
      emptyMessage: 'Aucune prestation trouvée.',
    );
    if (picked == null) return;
    final service = services.cast<PosCatalogItem?>().firstWhere(
          (s) => s?.id == picked.id,
          orElse: () => null,
        );
    if (service == null) return;

    final extraMatch = _extraCatalog.cast<ServiceExtraConfig?>().firstWhere(
          (e) => e?.extraServiceId == service.id,
          orElse: () => null,
        );
    if (extraMatch != null) {
      setState(() {
        final current = _extraQty[service.id] ?? 0;
        _extraQty[service.id] =
            (current + 1).clamp(extraMatch.minQty, extraMatch.maxQty);
      });
      return;
    }

    if (_added.any((s) => s.id == service.id)) return;
    setState(() {
      _added = [
        ..._added,
        _AddedService(
          id: service.id,
          name: service.name,
          durationMin: service.durationMin ?? 0,
          priceCents: service.priceCents,
        ),
      ];
    });
  }

  List<PickerItem> _serviceItems(List<PosCatalogItem> services) {
    return services
        .map(
          (s) => PickerItem(
            id: s.id,
            title: s.name,
            subtitle: s.priceCents > 0
                ? '${(s.priceCents / 100).toStringAsFixed(2)} €'
                : null,
            trailing: s.durationMin != null ? '${s.durationMin} min' : null,
          ),
        )
        .toList();
  }

  Future<bool> _askOverride(String message) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Créneau serré'),
        content: Text('$message\n\nVoulez-vous le placer quand même ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: _black),
            child: const Text('Placer quand même'),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  Future<void> _save({bool force = false}) async {
    if (_serviceId == null || _serviceId!.isEmpty) {
      setState(() => _error = 'Choisissez une prestation.');
      return;
    }
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      var shouldForce = force;
      while (true) {
        try {
          await ref.read(mobileApiProvider).updateAppointment(
                accessToken: token,
                tenantId: tenantId,
                appointmentId: widget.appointment.id,
                startsAt: _startsAt.toUtc().toIso8601String(),
                notes: _notes.text,
                serviceId: _serviceId,
                extras: _extrasPayload(),
                force: shouldForce,
              );
          if (mounted) Navigator.pop(context, true);
          return;
        } on MobileApiException catch (e) {
          final canForce = !shouldForce &&
              (e.code == 'conflict' || e.code == 'schedule');
          if (canForce && mounted && await _askOverride(e.message)) {
            shouldForce = true;
            continue;
          }
          if (mounted) setState(() => _error = e.message);
          return;
        }
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: posAsync.when(
          loading: () => const SizedBox(
            height: 280,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          error: (e, _) => Text('$e'),
          data: (pos) {
            final services = _catalogServices(pos);
            final selected = _selectedService(services);
            final minutes = _estimatedMinutes(services);
            final endsAt = _startsAt.add(Duration(minutes: minutes));

            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: _border,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Modifier le rendez-vous',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: _black,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: _saving ? null : () => Navigator.pop(context),
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.close_rounded, size: 22),
                        color: const Color(0xFF737373),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: SearchablePickerField(
                          label: 'Date',
                          value: dateFmt.format(_date),
                          placeholder: 'Choisir un jour',
                          selectedSubtitle: 'Modifier',
                          onOpen: _pickDate,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SearchablePickerField(
                          label: 'Heure',
                          value: timeFmt.format(_startsAt),
                          placeholder: 'Choisir une heure',
                          selectedSubtitle: 'Modifier',
                          onOpen: _pickTime,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Fin prévue ${timeFmt.format(endsAt)} · $minutes min',
                    style: const TextStyle(fontSize: 13, color: _muted),
                  ),
                  const SizedBox(height: 18),
                  SearchablePickerField(
                    label: 'Prestation',
                    value: selected?.name ?? widget.appointment.serviceName,
                    placeholder: 'Choisir une prestation',
                    selectedSubtitle: selected?.durationMin != null
                        ? '${selected!.durationMin} min'
                        : 'Touchez pour changer',
                    onOpen: () => _pickService(services),
                  ),
                  if (_loadingExtras) ...[
                    const SizedBox(height: 12),
                    const Text(
                      'Chargement des extras…',
                      style: TextStyle(fontSize: 12, color: _muted),
                    ),
                  ] else if (_extraCatalog.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Extras',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final extra in _extraCatalog)
                      _ExtraRow(
                        extra: extra,
                        quantity: _extraQty[extra.extraServiceId] ?? 0,
                        onChanged: (qty) {
                          setState(() {
                            if (qty <= 0) {
                              _extraQty.remove(extra.extraServiceId);
                            } else {
                              _extraQty[extra.extraServiceId] = qty;
                            }
                          });
                        },
                      ),
                  ],
                  if (_added.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    for (final added in _added)
                      _AddedRow(
                        service: added,
                        onRemove: () {
                          setState(() {
                            _added = _added.where((s) => s.id != added.id).toList();
                          });
                        },
                      ),
                  ],
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => _addService(services),
                      child: const Text('+ Ajouter une prestation'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Notes',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF404040),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notes,
                    minLines: 2,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Optionnel',
                      hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: _border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: _border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: _black, width: 1.4),
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFDC2626)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      style: FilledButton.styleFrom(
                        backgroundColor: _black,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Enregistrer'),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
  }
}

class _ExtraRow extends StatelessWidget {
  const _ExtraRow({
    required this.extra,
    required this.quantity,
    required this.onChanged,
  });

  final ServiceExtraConfig extra;
  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  extra.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
                Text(
                  '${extra.durationMin} min · ${(extra.priceCents / 100).toStringAsFixed(2)} €',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: quantity <= extra.minQty
                ? null
                : () => onChanged(quantity - 1),
            icon: const Icon(Icons.remove_circle_outline, size: 20),
          ),
          Text(
            '$quantity',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: quantity >= extra.maxQty
                ? null
                : () => onChanged(quantity + 1),
            icon: const Icon(Icons.add_circle_outline, size: 20),
          ),
        ],
      ),
    );
  }
}

class _AddedRow extends StatelessWidget {
  const _AddedRow({required this.service, required this.onRemove});

  final _AddedService service;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.spa_outlined, size: 18, color: Color(0xFF737373)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0A0A0A),
                  ),
                ),
                Text(
                  '${service.durationMin} min',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 18),
          ),
        ],
      ),
    );
  }
}
