import 'dart:async';

import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../state/session_providers.dart';
import '../../../widgets/client_picker.dart';
import '../../../widgets/new_client_form.dart';
import '../../../widgets/searchable_picker.dart';

Future<void> showCreateAppointmentSheet(
  BuildContext context,
  WidgetRef ref, {
  DateTime? initialDate,
  TimeOfDay? initialTime,
}) {
  return showModalBottomSheet<void>(
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
        child: _CreateAppointmentSheet(
          initialDate: initialDate,
          initialTime: initialTime,
        ),
      ),
    ),
  );
}

class _ServiceLine {
  String? serviceId;
  List<ServiceExtraConfig> catalog = const [];
  Map<String, int> extraQty = {};
  bool loadingExtras = false;
  String? extrasError;
}

class _CreateAppointmentSheet extends ConsumerStatefulWidget {
  const _CreateAppointmentSheet({
    this.initialDate,
    this.initialTime,
  });

  final DateTime? initialDate;
  final TimeOfDay? initialTime;

  @override
  ConsumerState<_CreateAppointmentSheet> createState() =>
      _CreateAppointmentSheetState();
}

class _CreateAppointmentSheetState
    extends ConsumerState<_CreateAppointmentSheet> {
  final List<_ServiceLine> _lines = [_ServiceLine()];
  String? _clientId;
  String? _clientTitle;
  String? _clientSubtitle;
  String? _staffId;
  late DateTime _date;
  late TimeOfDay _time;
  final _notesController = TextEditingController();
  String _recurrence = 'none';
  DateTime? _until;
  bool _untilManual = false;
  bool _saving = false;
  String? _error;
  Timer? _previewDebounce;
  RecurrencePreview? _preview;
  bool _previewLoading = false;
  String? _previewError;
  final Set<String> _skippedDates = {};

  static const _black = Color(0xFF0A0A0A);
  static const _border = Color(0xFFE5E5E5);

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date = widget.initialDate ?? DateTime(now.year, now.month, now.day);
    _time = widget.initialTime ??
        TimeOfDay(hour: now.hour, minute: (now.minute ~/ 15 + 1) * 15 % 60);
  }

  @override
  void dispose() {
    _previewDebounce?.cancel();
    _notesController.dispose();
    super.dispose();
  }

  List<PosCatalogItem> _catalogServices(PosContext pos) {
    return pos.catalog
        .where(
          (item) => item.type == 'service' && item.visibility != 'extra_only',
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
    if (picked == null) return;
    setState(() {
      _date = picked;
      if (_recurrence != 'none' && !_untilManual) {
        _until = _defaultUntil(_recurrence);
      } else if (_until != null && _until!.isBefore(_date)) {
        _until = _defaultUntil(_recurrence);
        _untilManual = false;
      }
    });
    _schedulePreview();
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked != null) {
      setState(() => _time = picked);
      _schedulePreview();
    }
  }

  Future<void> _pickUntil() async {
    final initial = _until ?? _defaultUntil(_recurrence);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: _date,
      lastDate: DateTime.now().add(const Duration(days: 400)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) {
      setState(() {
        _until = picked;
        _untilManual = true;
      });
      _schedulePreview();
    }
  }

  DateTime _addMonths(DateTime source, int months) {
    final day = source.day;
    final cursor = DateTime(source.year, source.month + months, 1);
    final lastDay = DateTime(cursor.year, cursor.month + 1, 0).day;
    return DateTime(cursor.year, cursor.month, day > lastDay ? lastDay : day);
  }

  DateTime _defaultUntil(String frequency) {
    switch (frequency) {
      case 'weekly':
        return _date.add(const Duration(days: 7 * 12));
      case 'biweekly':
        return _date.add(const Duration(days: 14 * 6));
      case 'monthly':
        return _addMonths(_date, 6);
      default:
        return _date.add(const Duration(days: 90));
    }
  }

  DateTime _nextOccurrence(String frequency) {
    switch (frequency) {
      case 'weekly':
        return _date.add(const Duration(days: 7));
      case 'biweekly':
        return _date.add(const Duration(days: 14));
      case 'monthly':
        return _addMonths(_date, 1);
      default:
        return _date;
    }
  }

  int _occurrenceCount(String frequency, DateTime until) {
    var count = 1;
    var cursor = _date;
    const max = 52;
    while (count < max) {
      if (frequency == 'weekly') {
        cursor = cursor.add(const Duration(days: 7));
      } else if (frequency == 'biweekly') {
        cursor = cursor.add(const Duration(days: 14));
      } else if (frequency == 'monthly') {
        cursor = _addMonths(cursor, 1);
      } else {
        return count;
      }
      if (cursor.isAfter(until)) break;
      count++;
    }
    return count;
  }

  void _setRecurrence(String frequency) {
    setState(() {
      _recurrence = frequency;
      _untilManual = false;
      _until = frequency == 'none' ? null : _defaultUntil(frequency);
      if (frequency == 'none') {
        _preview = null;
        _previewError = null;
        _skippedDates.clear();
      }
    });
    if (frequency != 'none') _schedulePreview();
  }

  List<AppointmentLineInput> _bookingLines() {
    return _lines
        .where((l) => l.serviceId != null && l.serviceId!.isNotEmpty)
        .map(
          (line) => AppointmentLineInput(
            serviceId: line.serviceId!,
            extras: line.extraQty.entries
                .where((e) => e.value > 0)
                .map(
                  (e) => BookingExtraLine(serviceId: e.key, quantity: e.value),
                )
                .toList(),
            staffId: _staffId,
          ),
        )
        .toList();
  }

  DateTime get _startsAt => DateTime(
        _date.year,
        _date.month,
        _date.day,
        _time.hour,
        _time.minute,
      );

  void _schedulePreview() {
    _previewDebounce?.cancel();
    if (_recurrence == 'none' || _bookingLines().isEmpty) {
      setState(() {
        _preview = null;
        _previewError = null;
        _previewLoading = false;
        _skippedDates.clear();
      });
      return;
    }
    setState(() => _previewLoading = true);
    _previewDebounce = Timer(const Duration(milliseconds: 350), _loadPreview);
  }

  Future<void> _loadPreview() async {
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    final lines = _bookingLines();
    if (token == null || tenantId == null || lines.isEmpty) return;
    try {
      final preview = await ref.read(mobileApiProvider).previewRecurrence(
            accessToken: token,
            tenantId: tenantId,
            startsAt: _startsAt.toUtc().toIso8601String(),
            lines: lines,
            clientId: _clientId,
            staffId: _staffId,
            recurrenceFrequency: _recurrence,
            recurrenceUntil: _until == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_until!),
          );
      if (!mounted) return;
      setState(() {
        _preview = preview;
        _previewLoading = false;
        _previewError = null;
        _skippedDates
          ..clear()
          ..addAll(
            preview.occurrences
                .where((o) => o.conflict && !o.isFirst)
                .map((o) => o.date),
          );
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _previewLoading = false;
        _previewError = e.toString();
      });
    }
  }

  Future<void> _loadExtras(_ServiceLine line) async {
    final serviceId = line.serviceId;
    if (serviceId == null || serviceId.isEmpty) {
      setState(() {
        line.catalog = const [];
        line.extraQty = {};
        line.loadingExtras = false;
        line.extrasError = null;
      });
      return;
    }
    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    setState(() {
      line.loadingExtras = true;
      line.extrasError = null;
    });
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
      setState(() {
        line.catalog = catalog;
        line.extraQty = qty;
        line.loadingExtras = false;
      });
      _schedulePreview();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        line.catalog = const [];
        line.extraQty = {};
        line.loadingExtras = false;
        line.extrasError = 'Impossible de charger les extras.';
      });
    }
  }

  Future<void> _save() async {
    final filled = _lines.where((l) => l.serviceId != null && l.serviceId!.isNotEmpty).toList();
    if (filled.isEmpty) {
      setState(() => _error = 'Choisissez au moins une prestation.');
      return;
    }

    final token = ref.read(accessTokenProvider);
    final tenantId = ref.read(selectedTenantIdProvider);
    if (token == null || tenantId == null) return;

    final firstConflict = _preview?.occurrences.any((o) => o.isFirst && o.conflict) ?? false;
    if (firstConflict) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Premier créneau occupé'),
          content: Text(
            _preview?.occurrences.first.reason ??
                'Ce créneau est déjà pris. Voulez-vous le placer quand même ?',
          ),
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
      if (ok != true) return;
    }

    final keptConflicts = _preview?.occurrences
            .where((o) => o.conflict && !_skippedDates.contains(o.date))
            .isNotEmpty ??
        false;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final lines = _bookingLines();
      await ref.read(mobileApiProvider).createAppointment(
            accessToken: token,
            tenantId: tenantId,
            startsAt: _startsAt.toUtc().toIso8601String(),
            clientId: _clientId,
            staffId: _staffId,
            notes: _notesController.text.trim(),
            lines: lines,
            recurrenceFrequency: _recurrence,
            recurrenceUntil: _recurrence == 'none' || _until == null
                ? null
                : DateFormat('yyyy-MM-dd').format(_until!),
            skipDates: _skippedDates.toList(),
            force: firstConflict || keptConflicts,
          );
      ref.invalidate(dayAgendaProvider);
      ref.invalidate(todayAgendaProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<PickerItem> _servicesToItems(List<PosCatalogItem> services) {
    return services
        .map(
          (s) => PickerItem(
            id: s.id,
            title: s.name,
            subtitle: s.priceCents > 0
                ? '${(s.priceCents / 100).toStringAsFixed(2)} €'
                : null,
            trailing: s.durationMin != null ? '${s.durationMin} min' : null,
            groupId: s.serviceCategoryId?.isNotEmpty == true
                ? s.serviceCategoryId
                : '__none__',
            groupLabel: s.serviceCategoryName?.trim().isNotEmpty == true
                ? s.serviceCategoryName
                : 'Sans catégorie',
          ),
        )
        .toList();
  }

  List<PickerItem> _staffToItems(List<PosOption> staff) {
    return staff.map((s) => PickerItem(id: s.id, title: s.label)).toList();
  }

  Future<void> _openServicePicker(
    List<PosCatalogItem> services,
    _ServiceLine line,
  ) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une prestation',
      items: _servicesToItems(services),
      selectedId: line.serviceId,
      searchHint: 'Rechercher une prestation…',
      emptyMessage: 'Aucune prestation trouvée.',
    );
    if (picked == null) return;
    setState(() {
      line.serviceId = picked.id;
      line.catalog = const [];
      line.extraQty = {};
    });
    await _loadExtras(line);
    _schedulePreview();
  }

  Future<void> _openClientPicker() async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une cliente',
      items: const [],
      search: (q, {fromLetter}) => searchInstitutClients(
        ref,
        q,
        fromLetter: fromLetter,
      ),
      showAlphabet: true,
      selectedId: _clientId,
      searchHint: 'Rechercher (nom, email, téléphone)…',
      nullOption: const PickerItem(id: '__none__', title: 'Sans cliente'),
      emptyMessage: 'Aucune cliente trouvée.',
      createAction: newClientPickerAction(ref),
    );
    if (picked == null) return;
    setState(() {
      if (picked.id == '__none__') {
        _clientId = null;
        _clientTitle = null;
        _clientSubtitle = null;
      } else {
        _clientId = picked.id;
        _clientTitle = picked.title;
        _clientSubtitle = picked.subtitle;
      }
    });
    _schedulePreview();
  }

  Future<void> _openStaffPicker(List<PosOption> staff) async {
    final picked = await showSearchablePicker(
      context: context,
      title: 'Choisir une praticienne',
      items: _staffToItems(staff),
      selectedId: _staffId,
      searchHint: 'Rechercher…',
      nullOption: const PickerItem(id: '__none__', title: 'Non assignée'),
      emptyMessage: 'Aucune praticienne trouvée.',
    );
    if (picked == null) return;
    setState(() {
      _staffId = picked.id == '__none__' ? null : picked.id;
    });
    _schedulePreview();
  }

  @override
  Widget build(BuildContext context) {
    final posAsync = ref.watch(posContextProvider);
    final dateFmt = DateFormat('EEEE d MMMM', 'fr_FR');
    final timeFmt = DateFormat.Hm();
    final untilFmt = DateFormat('d MMMM y', 'fr_FR');

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
            final untilDate = _until ?? _defaultUntil(_recurrence);
            final nextDate = _nextOccurrence(_recurrence);
            final occurrenceCount = _occurrenceCount(_recurrence, untilDate);
            final selectedClient = _clientId == null
                ? null
                : pos.clients.firstWhere(
                    (c) => c.id == _clientId,
                    orElse: () => PosOption(id: _clientId!, label: ''),
                  );
            final selectedClientSplit = selectedClient == null
                ? null
                : splitLabelWithEmail(selectedClient.label);
            final selectedStaff = _staffId == null
                ? null
                : pos.staff.firstWhere(
                    (s) => s.id == _staffId,
                    orElse: () => PosOption(id: _staffId!, label: ''),
                  );

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
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
                          'Nouveau rendez-vous',
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
                  const SizedBox(height: 8),
                  SearchablePickerField(
                    label: 'Cliente',
                    value: _clientTitle ??
                        (selectedClientSplit?.title.isNotEmpty == true
                            ? selectedClientSplit!.title
                            : null),
                    selectedSubtitle: _clientSubtitle ?? selectedClientSplit?.subtitle,
                    placeholder: 'Sans cliente',
                    onOpen: _openClientPicker,
                  ),
                  const SizedBox(height: 10),
                  SearchablePickerField(
                    label: 'Praticienne',
                    value: selectedStaff?.label.isNotEmpty == true
                        ? selectedStaff!.label
                        : null,
                    placeholder: 'Non assignée',
                    onOpen: () => _openStaffPicker(pos.staff),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Date'),
                            const SizedBox(height: 6),
                            OutlinedButton(
                              onPressed: _pickDate,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  dateFmt.format(_date),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Heure'),
                            const SizedBox(height: 6),
                            OutlinedButton(
                              onPressed: _pickTime,
                              style: _outlineStyle(),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  timeFmt.format(DateTime(
                                    _date.year,
                                    _date.month,
                                    _date.day,
                                    _time.hour,
                                    _time.minute,
                                  )),
                                  style: const TextStyle(color: _black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  for (var i = 0; i < _lines.length; i++) ...[
                    _buildServiceLine(services, _lines[i], i),
                    const SizedBox(height: 10),
                  ],
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => setState(() => _lines.add(_ServiceLine())),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 32),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        foregroundColor: _black,
                      ),
                      child: const Text(
                        '+ Ajouter une prestation',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Divider(height: 1, color: _border),
                  _InlineRow(
                    label: 'Récurrence',
                    value: _recurrenceLabel(_recurrence),
                    onTap: _openRecurrencePicker,
                  ),
                  if (_recurrence != 'none') ...[
                    const Divider(height: 1, color: _border),
                    _InlineRow(
                      label: 'Jusqu’au',
                      value: untilFmt.format(untilDate),
                      onTap: _pickUntil,
                    ),
                    const Divider(height: 1, color: _border),
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 4),
                      child: Text(
                        'Prochaine le ${untilFmt.format(nextDate)} · $occurrenceCount rendez-vous',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
                      ),
                    ),
                    _RecurrencePreviewCard(
                      loading: _previewLoading,
                      error: _previewError,
                      preview: _preview,
                      skipped: _skippedDates,
                      dateFmt: untilFmt,
                      onToggleSkip: (date) {
                        setState(() {
                          if (_skippedDates.contains(date)) {
                            _skippedDates.remove(date);
                          } else {
                            _skippedDates.add(date);
                          }
                        });
                      },
                    ),
                    const Divider(height: 1, color: _border),
                  ] else
                    const Divider(height: 1, color: _border),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _notesController,
                    decoration: _inputDecoration(hint: 'Ajouter une note (optionnel)'),
                    style: const TextStyle(fontSize: 14),
                    maxLines: 2,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Color(0xFFDC2626))),
                  ],
                  const SizedBox(height: 18),
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
                        textStyle: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
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
                          : Text(
                              _recurrence != 'none' || _lines.length > 1
                                  ? 'Créer les rendez-vous'
                                  : 'Créer le rendez-vous',
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
  }

  Widget _buildServiceLine(
    List<PosCatalogItem> services,
    _ServiceLine line,
    int index,
  ) {
    final selectedService = line.serviceId == null
        ? null
        : services.cast<PosCatalogItem?>().firstWhere(
              (s) => s?.id == line.serviceId,
              orElse: () => null,
            );
    final label = _lines.length > 1 ? 'Prestation ${index + 1}' : 'Prestation';
    final canRemove = _lines.length > 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SearchablePickerField(
          label: label,
          labelTrailing: canRemove
              ? InkWell(
                  onTap: () => setState(() => _lines.removeAt(index)),
                  borderRadius: BorderRadius.circular(999),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: Color(0xFF737373),
                    ),
                  ),
                )
              : null,
          value: selectedService?.name.isNotEmpty == true
              ? selectedService!.name
              : null,
          placeholder: 'Choisir une prestation',
          selectedSubtitle: selectedService?.durationMin != null
              ? '${selectedService!.durationMin} min'
              : null,
          onOpen: () => _openServicePicker(services, line),
        ),
        if (line.loadingExtras) ...[
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Text(
              'Chargement des extras…',
              style: TextStyle(fontSize: 12, color: Color(0xFF737373)),
            ),
          ),
        ] else if (line.extrasError != null) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              line.extrasError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ),
        ] else if (line.catalog.isNotEmpty) ...[
          const SizedBox(height: 6),
          for (final extra in line.catalog)
            _ExtraRow(
              extra: extra,
              quantity: line.extraQty[extra.extraServiceId] ?? 0,
              onChanged: (qty) {
                setState(() {
                  if (qty <= 0) {
                    line.extraQty.remove(extra.extraServiceId);
                  } else {
                    line.extraQty[extra.extraServiceId] = qty;
                  }
                });
                _schedulePreview();
              },
            ),
        ],
      ],
    );
  }

  String _recurrenceLabel(String value) {
    switch (value) {
      case 'weekly':
        return 'Toutes les semaines';
      case 'biweekly':
        return 'Toutes les 2 semaines';
      case 'monthly':
        return 'Tous les mois';
      default:
        return 'Aucune';
    }
  }

  Future<void> _openRecurrencePicker() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
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
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Text(
                'Répéter',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _black,
                ),
              ),
            ),
            for (final option in const [
              ('none', 'Aucune'),
              ('weekly', 'Toutes les semaines'),
              ('biweekly', 'Toutes les 2 semaines'),
              ('monthly', 'Tous les mois'),
            ]) ...[
              InkWell(
                onTap: () => Navigator.pop(ctx, option.$1),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          option.$2,
                          style: const TextStyle(fontSize: 15, color: _black),
                        ),
                      ),
                      if (option.$1 == _recurrence)
                        const Icon(
                          Icons.check_rounded,
                          size: 20,
                          color: _black,
                        ),
                    ],
                  ),
                ),
              ),
              if (option.$1 != 'monthly')
                const Divider(height: 1, color: _border, indent: 20, endIndent: 20),
            ],
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
    if (picked != null) _setRecurrence(picked);
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 15),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
    );
  }

  ButtonStyle _outlineStyle() {
    return OutlinedButton.styleFrom(
      foregroundColor: _black,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      side: const BorderSide(color: _border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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

class _RecurrencePreviewCard extends StatelessWidget {
  const _RecurrencePreviewCard({
    required this.loading,
    required this.error,
    required this.preview,
    required this.skipped,
    required this.dateFmt,
    required this.onToggleSkip,
  });

  final bool loading;
  final String? error;
  final RecurrencePreview? preview;
  final Set<String> skipped;
  final DateFormat dateFmt;
  final ValueChanged<String> onToggleSkip;

  @override
  Widget build(BuildContext context) {
    if (loading && preview == null) {
      return const Padding(
        padding: EdgeInsets.only(top: 4),
        child: Text(
          'Vérification des créneaux…',
          style: TextStyle(fontSize: 12, color: Color(0xFF737373)),
        ),
      );
    }
    if (error != null && preview == null) {
      return Text(
        error!,
        style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
      );
    }
    final data = preview;
    if (data == null) return const SizedBox.shrink();

    final conflicts = data.occurrences.where((o) => o.conflict).toList();
    if (conflicts.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFBBF7D0)),
        ),
        child: Text(
          '${data.freeCount} dates libres — la récurrence est possible.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF166534)),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            data.freeCount == 0
                ? 'Aucune date libre sur cette récurrence.'
                : '${data.conflictCount} date${data.conflictCount > 1 ? 's' : ''} occupée${data.conflictCount > 1 ? 's' : ''} · ${data.freeCount} libre${data.freeCount > 1 ? 's' : ''}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF9A3412),
            ),
          ),
          const SizedBox(height: 8),
          for (final item in conflicts) ...[
            Text(
              dateFmt.format(item.startsAt),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0A0A0A),
              ),
            ),
            Text(
              item.reason ?? 'Créneau déjà occupé.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF737373)),
            ),
            if (!item.isFirst)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => onToggleSkip(item.date),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 32),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: const Color(0xFF0A0A0A),
                  ),
                  child: Text(
                    skipped.contains(item.date)
                        ? 'Date sautée — appuyer pour la garder'
                        : 'Garder cette date quand même',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              )
            else
              const Padding(
                padding: EdgeInsets.only(bottom: 8, top: 2),
                child: Text(
                  'Changez l’heure, ou confirmez au moment de créer.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF9A3412)),
                ),
              ),
            const SizedBox(height: 6),
          ],
          Text(
            skipped.isEmpty
                ? 'Les dates occupées seront tout de même créées.'
                : 'Solution : les dates occupées seront sautées, le reste de la série est créé.',
            style: const TextStyle(fontSize: 12, color: Color(0xFF9A3412)),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: Color(0xFF404040),
      ),
    );
  }
}

/// Ligne compacte style iOS Reminders : `Label ......... Valeur >`.
/// Utilisée pour Récurrence / Jusqu'au — évite les gros dropdowns.
class _InlineRow extends StatelessWidget {
  const _InlineRow({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF0A0A0A),
              ),
            ),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(fontSize: 14, color: Color(0xFF737373)),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Color(0xFF9CA3AF),
            ),
          ],
        ),
      ),
    );
  }
}
