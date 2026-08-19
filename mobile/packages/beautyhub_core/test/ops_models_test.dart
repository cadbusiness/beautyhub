import 'package:beautyhub_core/beautyhub_core.dart';
import 'package:flutter_test/flutter_test.dart';

DayAppointment _appt({
  required String id,
  required DateTime startsAt,
  required DateTime endsAt,
  String status = 'booked',
  String? resourceId,
  String? resourceName,
}) {
  return DayAppointment(
    id: id,
    startsAt: startsAt,
    endsAt: endsAt,
    status: status,
    clientName: 'Client $id',
    serviceName: 'Soin',
    resourceId: resourceId,
    resourceName: resourceName,
  );
}

void main() {
  test('DayAppointment parses cabin fields', () {
    final appointment = DayAppointment.fromJson({
      'id': 'a1',
      'startsAt': '2026-08-19T13:30:00.000Z',
      'endsAt': '2026-08-19T14:30:00.000Z',
      'status': 'booked',
      'clientName': 'Valérie Focan',
      'serviceName': 'Soin visage',
      'resourceId': 'cabin-1',
      'resourceName': 'Cabine 1',
      'serviceDurationMin': 60,
    });

    expect(appointment.resourceId, 'cabin-1');
    expect(appointment.resourceName, 'Cabine 1');
    expect(appointment.durationLabel, "60'");
  });

  test('DayAppointment duration includes extras', () {
    final appointment = DayAppointment.fromJson({
      'id': 'a1',
      'startsAt': '2026-08-19T13:30:00.000Z',
      'endsAt': '2026-08-19T15:00:00.000Z',
      'status': 'booked',
      'clientName': 'Karina',
      'serviceName': 'Épilation',
      'serviceDurationMin': 30,
      'extras': [
        {
          'serviceId': 'extra-1',
          'quantity': 1,
          'name': 'Jambes',
          'durationMin': 30,
        },
        {
          'serviceId': 'extra-2',
          'quantity': 2,
          'name': 'Maillot',
          'durationMin': 15,
        },
      ],
    });

    expect(appointment.extrasDurationMin, 60);
    expect(appointment.durationMinutes, 90);
    expect(appointment.extras.first.durationMin, 30);
  });

  test('groupAppointmentsByStart keeps parallel cabins together', () {
    final t1 = DateTime(2026, 8, 19, 13, 30);
    final t2 = DateTime(2026, 8, 19, 14, 0);
    final groups = groupAppointmentsByStart([
      _appt(
        id: '1',
        startsAt: t1,
        endsAt: t1.add(const Duration(minutes: 60)),
        resourceName: 'Cabine 1',
      ),
      _appt(
        id: '2',
        startsAt: t1,
        endsAt: t1.add(const Duration(minutes: 75)),
        resourceName: 'Cabine 2',
      ),
      _appt(
        id: '3',
        startsAt: t2,
        endsAt: t2.add(const Duration(minutes: 45)),
        resourceName: 'Cabine 1',
      ),
    ]);

    expect(groups.length, 2);
    expect(groups.first.isParallel, isTrue);
    expect(groups.first.appointments.map((a) => a.id), ['1', '2']);
    expect(groups.last.appointments.single.id, '3');
  });

  test('nextParallelAppointments returns same-time cabins', () {
    final now = DateTime(2026, 8, 19, 8, 0);
    final nine = DateTime(2026, 8, 19, 9, 0);
    final later = DateTime(2026, 8, 19, 13, 30);
    final next = nextParallelAppointments(
      [
        _appt(
          id: '1',
          startsAt: nine,
          endsAt: nine.add(const Duration(minutes: 60)),
          resourceName: 'Cabine 1',
        ),
        _appt(
          id: '2',
          startsAt: nine,
          endsAt: nine.add(const Duration(minutes: 60)),
          resourceName: 'Cabine 2',
        ),
        _appt(
          id: '3',
          startsAt: later,
          endsAt: later.add(const Duration(minutes: 60)),
          resourceName: 'Cabine 1',
        ),
      ],
      now: now,
    );

    expect(next.map((a) => a.id), ['1', '2']);
  });

  test('nextParallelAppointments ignores cancelled siblings', () {
    final now = DateTime(2026, 8, 19, 8, 0);
    final nine = DateTime(2026, 8, 19, 9, 0);
    final next = nextParallelAppointments(
      [
        _appt(
          id: '1',
          startsAt: nine,
          endsAt: nine.add(const Duration(minutes: 60)),
        ),
        _appt(
          id: '2',
          startsAt: nine,
          endsAt: nine.add(const Duration(minutes: 60)),
          status: 'cancelled',
        ),
      ],
      now: now,
    );

    expect(next.map((a) => a.id), ['1']);
  });

  test('nextParallelAppointments ignores a hint that has already ended', () {
    // À 10h15, on ne veut plus voir le RDV de 10h (terminé à 10h10)
    // mais celui de 10h15 même si le serveur avait renvoyé le premier.
    final now = DateTime(2026, 8, 19, 10, 15);
    final ten = DateTime(2026, 8, 19, 10, 0);
    final tenTen = DateTime(2026, 8, 19, 10, 10);
    final tenFifteen = DateTime(2026, 8, 19, 10, 15);
    final staleHint = _appt(
      id: '1',
      startsAt: ten,
      endsAt: tenTen,
    );
    final next = nextParallelAppointments(
      [
        staleHint,
        _appt(
          id: '2',
          startsAt: tenFifteen,
          endsAt: tenFifteen.add(const Duration(minutes: 30)),
        ),
      ],
      now: now,
      hint: staleHint,
    );

    expect(next.map((a) => a.id), ['2']);
  });

  test('RecurrencePreview parses conflict dates', () {
    final preview = RecurrencePreview.fromJson({
      'frequency': 'weekly',
      'durationMin': 30,
      'freeCount': 1,
      'conflictCount': 1,
      'occurrences': [
        {
          'date': '2026-08-19',
          'startsAt': '2026-08-19T07:00:00.000Z',
          'endsAt': '2026-08-19T07:30:00.000Z',
          'isFirst': true,
          'conflict': false,
        },
        {
          'date': '2026-08-26',
          'startsAt': '2026-08-26T07:00:00.000Z',
          'endsAt': '2026-08-26T07:30:00.000Z',
          'isFirst': false,
          'conflict': true,
          'kind': 'clientBusy',
          'reason': 'Cette cliente a déjà un rendez-vous.',
          'otherClientName': 'Karina',
          'otherServiceName': 'Soin visage',
        },
      ],
    });

    expect(preview.conflictCount, 1);
    expect(preview.occurrences.last.conflict, isTrue);
    expect(preview.occurrences.last.kind, 'clientBusy');
  });
}
