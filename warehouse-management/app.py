import re
from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = 'thisshouldbeasecret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///warehouse.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(10), nullable=False)

class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vehicle_number = db.Column(db.String(100))
    bill_number = db.Column(db.String(100), unique=True)
    shipper_name = db.Column(db.String(100))
    weight = db.Column(db.Float)
    item_name = db.Column(db.String(100))
    city_from = db.Column(db.String(100))

class Gaging(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bill_number = db.Column(db.String(100), db.ForeignKey('item.bill_number'))
    waste_weight = db.Column(db.Float)
    gaging_cost = db.Column(db.Float)
    vehicle_number = db.Column(db.String(100))

class Dispatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bill_number = db.Column(db.String(100), db.ForeignKey('item.bill_number'))
    vehicle_number = db.Column(db.String(100))
    customer_name = db.Column(db.String(100))
    destination_place = db.Column(db.String(100))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def is_valid_username(username):
    return bool(re.fullmatch(r'[A-Za-z]+', username))

def is_valid_password(password):
    return (len(password) >= 8 and re.search(r'[A-Za-z]', password) and re.search(r'\d', password))

def is_valid_vehicle_number(vehicle_number):
    pattern = r'^[A-Z]{2}\d{2}\s?[A-Z]{1,2}\s?\d{4}$'
    return re.match(pattern, vehicle_number.upper())

def parse_weight(weight_str):
    weight_str = weight_str.strip().lower()
    try:
        if "ton" in weight_str:
            value = float(weight_str.replace("ton", "").strip())
            return value * 1000  # tons to kg
        elif "kg" in weight_str:
            value = float(weight_str.replace("kg", "").strip())
            return value
        else:
            return float(weight_str)
    except:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        role = request.form.get('role')
        if not is_valid_username(username):
            flash('Username must only contain letters (A-Z, a-z).')
            return render_template('register.html')
        if not is_valid_password(password):
            flash('Password must be at least 8 characters and include letters and numbers.')
            return render_template('register.html')
        if User.query.filter_by(username=username).first():
            flash('Username already exists.')
            return render_template('register.html')
        hashed_pw = generate_password_hash(password)
        new_user = User(username=username, password=hashed_pw, role=role)
        db.session.add(new_user)
        db.session.commit()
        flash('Registration successful! Please log in.')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid Credentials')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    item_count = Item.query.count()
    gaging_count = Gaging.query.count()
    dispatch_count = Dispatch.query.count()
    return render_template('dashboard.html', user=current_user,
                           item_count=item_count, gaging_count=gaging_count, dispatch_count=dispatch_count)

@app.route('/add_item', methods=['GET', 'POST'])
@login_required
def add_item():
    if request.method == 'POST':
        try:
            vehicle_number = request.form['vehicle_number'].strip()
            if not is_valid_vehicle_number(vehicle_number):
                flash("Invalid vehicle number format (example: KA01AB1234, TN10 AB 1234)")
                return render_template('add_item.html')
            weight_input = request.form['weight']
            weight_kg = parse_weight(weight_input)
            if weight_kg is None:
                flash("Please enter weight as a number with 'kg' or 'ton' (e.g., 1200 kg, 1.5 ton)")
                return render_template('add_item.html')
            item = Item(
                vehicle_number=vehicle_number.upper().replace(" ", ""),
                bill_number=request.form['bill_number'],
                shipper_name=request.form['shipper_name'],
                weight=weight_kg,
                item_name=request.form['item_name'],
                city_from=request.form['city_from']
            )
            db.session.add(item)
            db.session.commit()
            flash('Item Added!')
            return redirect(url_for('dashboard'))
        except Exception as e:
            db.session.rollback()
            if 'UNIQUE constraint' in str(e):
                flash('Bill number already exists!')
            else:
                flash('Error: {}'.format(e))
    return render_template('add_item.html')

@app.route('/gaging', methods=['GET', 'POST'])
@login_required
def gaging():
    if request.method == 'POST':
        try:
            bill_number = request.form['bill_number']
            if not Item.query.filter_by(bill_number=bill_number).first():
                flash('Bill number does not exist!')
                return render_template('gaging.html')
            gaging = Gaging(
                bill_number=bill_number,
                waste_weight=float(request.form['waste_weight']),
                gaging_cost=float(request.form['gaging_cost']),
                vehicle_number=request.form['vehicle_number']
            )
            db.session.add(gaging)
            db.session.commit()
            flash('Gaging Information Saved!')
            return redirect(url_for('dashboard'))
        except Exception as e:
            db.session.rollback()
            flash('Error: {}'.format(e))
    return render_template('gaging.html')

@app.route('/dispatch', methods=['GET', 'POST'])
@login_required
def dispatch():
    if request.method == 'POST':
        try:
            bill_number = request.form['bill_number']
            if not Item.query.filter_by(bill_number=bill_number).first():
                flash('Bill number does not exist!')
                return render_template('dispatch.html')
            dispatch = Dispatch(
                bill_number=bill_number,
                vehicle_number=request.form['vehicle_number'],
                customer_name=request.form['customer_name'],
                destination_place=request.form['destination_place']
            )
            db.session.add(dispatch)
            db.session.commit()
            flash('Dispatch Information Saved!')
            return redirect(url_for('dashboard'))
        except Exception as e:
            db.session.rollback()
            flash('Error: {}'.format(e))
    return render_template('dispatch.html')

@app.route('/view_items')
@login_required
def view_items():
    items = Item.query.all()
    gaging = {g.bill_number: g for g in Gaging.query.all()}
    dispatches = {d.bill_number: d for d in Dispatch.query.all()}
    return render_template('view_items.html', items=items, gaging=gaging, dispatches=dispatches)

# --- Edit endpoint ---
@app.route('/edit_item/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_item(item_id):
    item = Item.query.get_or_404(item_id)
    if request.method == 'POST':
        try:
            vehicle_number = request.form['vehicle_number'].strip()
            if not is_valid_vehicle_number(vehicle_number):
                flash("Invalid vehicle number format (example: KA01AB1234, TN10 AB 1234)")
                return render_template('edit_item.html', item=item)
            weight_kg = parse_weight(request.form['weight'])
            if weight_kg is None:
                flash("Please enter weight as a number with 'kg' or 'ton' (e.g., 1200 kg, 1.5 ton)")
                return render_template('edit_item.html', item=item)
            # Check for bill number uniqueness (if changed)
            new_bill_number = request.form['bill_number']
            if new_bill_number != item.bill_number:
                if Item.query.filter_by(bill_number=new_bill_number).first():
                    flash('Bill number already exists!')
                    return render_template('edit_item.html', item=item)
            item.bill_number = new_bill_number
            item.vehicle_number = vehicle_number.upper().replace(" ", "")
            item.shipper_name = request.form['shipper_name']
            item.weight = weight_kg
            item.item_name = request.form['item_name']
            item.city_from = request.form['city_from']
            db.session.commit()
            flash('Item updated!')
            return redirect(url_for('view_items'))
        except Exception as e:
            db.session.rollback()
            if 'UNIQUE constraint' in str(e):
                flash('Bill number already exists!')
            else:
                flash('Error: {}'.format(e))
    return render_template('edit_item.html', item=item)

# --- Delete endpoints ---
@app.route('/delete_item/<int:item_id>', methods=['POST'])
@login_required
def delete_item(item_id):
    item = Item.query.get(item_id)
    if item:
        db.session.delete(item)
        db.session.commit()
        flash('Item deleted.')
    return redirect(url_for('view_items'))

@app.route('/delete_gaging/<int:gaging_id>', methods=['POST'])
@login_required
def delete_gaging(gaging_id):
    gaging = Gaging.query.get(gaging_id)
    if gaging:
        db.session.delete(gaging)
        db.session.commit()
        flash('Gaging entry deleted.')
    return redirect(url_for('view_items'))

@app.route('/delete_dispatch/<int:dispatch_id>', methods=['POST'])
@login_required
def delete_dispatch(dispatch_id):
    dispatch = Dispatch.query.get(dispatch_id)
    if dispatch:
        db.session.delete(dispatch)
        db.session.commit()
        flash('Dispatch entry deleted.')
    return redirect(url_for('view_items'))

# --- Live search API ---
@app.route('/search_items')
@login_required
def search_items():
    q = request.args.get('q', '').strip()
    query = Item.query
    if q:
        query = query.filter(
            (Item.bill_number.ilike(f"%{q}%")) |
            (Item.vehicle_number.ilike(f"%{q}%")) |
            (Item.shipper_name.ilike(f"%{q}%")) |
            (Item.item_name.ilike(f"%{q}%")) |
            (Item.city_from.ilike(f"%{q}%"))
        )
    items = query.all()
    gaging = {g.bill_number: g for g in Gaging.query.all()}
    dispatches = {d.bill_number: d for d in Dispatch.query.all()}
    rendered = render_template('_items_table.html', items=items, gaging=gaging, dispatches=dispatches)
    return jsonify({'html': rendered})

@app.cli.command('create_users')
def create_users():
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', password=generate_password_hash('Admin2025'), role='admin')
        db.session.add(admin)
    if not User.query.filter_by(username='staff').first():
        staff = User(username='staff', password=generate_password_hash('Staff2025'), role='staff')
        db.session.add(staff)
    db.session.commit()
    print("Admin and Staff users created.")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)