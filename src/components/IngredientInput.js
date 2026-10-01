import React, { Component } from 'react';
import "./style.css";

class IngredientInput extends Component {
    state = {
        name: "",
        date_expire: "",
        quantity: "",
        fridge_bool: "true",
        saving: false
    }

    updateIngredient = (event) => {
        //Input ingredient into sequelize
        const { name, value } = event.target;
        this.setState({
            [name]: value
        })
    }

    submitIngredient = async (event) => {
        event.preventDefault();
        if (this.state.saving) return;
        this.setState({ saving: true });
        const saved = await this.props.addIngredient({
            name: this.state.name,
            date_expire: this.state.date_expire,
            quantity: Number(this.state.quantity) || 1,
            fridge_bool: this.state.fridge_bool === "true"
        });
        // Keep what was typed if saving failed, so it can be fixed and retried
        this.setState(saved
            ? { name: "", date_expire: "", quantity: "", fridge_bool: this.state.fridge_bool, saving: false }
            : { saving: false });
    }

    render() {
        return (
            <form onSubmit={this.submitIngredient}>
                <div className="container">
                    <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input type="text"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="ingredient_name"
                            placeholder="Enter Ingredient Name"
                            name="name"
                            value={this.state.name}
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Expiration Date:</label>
                        <input type="date"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="date_expire"
                            placeholder="Enter Expiration Date"
                            name="date_expire"
                            value={this.state.date_expire}
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Quantity:</label>
                        <input type="number"
                            min="1"
                            max="9999"
                            step="1"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="quantity"
                            placeholder="Enter Ingredient Quantity"
                            name="quantity"
                            value={this.state.quantity}
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Fridge or Pantry:</label>
                        <div>
                        <label htmlFor="name">Fridge</label>
                        <input type="radio" id="fridge_bool" name="fridge_bool" value={true} checked={this.state.fridge_bool === "true"} onChange={this.updateIngredient}></input>
                        </div>
                        <div>
                        <label htmlFor="name">Pantry</label>
                        <input type="radio" id="fridge_bool" name="fridge_bool" value={false} checked={this.state.fridge_bool === "false"} onChange={this.updateIngredient}></input>
                        </div>
                        
                        {/* <input type="radio"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="fridge_bool"
                            name="fridge_bool"
                            required>
                                <option value={true}>Fridge</option>
                                <option value={false}>Pantry</option>
                        </input> */}
                    </div>
                    <button type="submit" disabled={this.state.saving} className="px-3 py-2 rounded-md bg-black-500 text-white focus:outline-none hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">Submit</button>
                </div>
            </form>
        )
    }

}

export default IngredientInput